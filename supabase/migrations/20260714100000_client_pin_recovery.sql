-- Function to recover client PIN
CREATE OR REPLACE FUNCTION public.gsa_recuperar_senha_cliente(
  p_documento text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_record record;
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_email text := trim(lower(coalesce(p_email, '')));
  v_new_pin text;
  v_pin_hash text;
BEGIN
  IF length(v_documento) < 11 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Documento inválido.');
  END IF;

  IF length(v_email) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail inválido.');
  END IF;

  -- Verify client exists and email matches
  SELECT id, nome, email, status
    INTO v_record
  FROM public.clientes
  WHERE regexp_replace(coalesce(cpf, cnpj, ''), '\D', '', 'g') = v_documento
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado.');
  END IF;

  IF trim(lower(coalesce(v_record.email, ''))) <> v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail não corresponde ao cadastro.');
  END IF;

  -- Generate a random 4-digit PIN
  v_new_pin := lpad(floor(random() * 10000)::text, 4, '0');
  
  -- Hash the PIN
  v_pin_hash := extensions.crypt(v_new_pin, extensions.gen_salt('bf', 12));

  -- Update the database
  UPDATE public.clientes
     SET pin_hash = v_pin_hash,
         pin_tentativas = 0,
         pin_bloqueado = false,
         updated_at = now()
   WHERE id = v_record.id;

  -- Here we would ideally insert into an email queue table:
  -- INSERT INTO public.notificacoes_fila (tipo, destinatario, titulo, mensagem) ...
  -- But for now, since we don't have the email worker configured, we return the PIN 
  -- so the UI can show it temporarily for testing/presentation.
  
  -- Log the action
  -- INSERT INTO public.system_logs (ator_tipo, ator_id, acao, detalhes)
  -- VALUES ('cliente', v_record.id, 'RECUPERAR_SENHA', 'Senha redefinida via recuperação de email');

  RETURN jsonb_build_object(
    'success', true, 
    'mensagem', 'Sua nova senha foi gerada. Em ambiente de produção, ela seria enviada para o seu e-mail.',
    'novo_pin', v_new_pin
  );
END;
$$;
