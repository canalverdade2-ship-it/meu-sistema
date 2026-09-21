
UPDATE public.gsa_calculator_pro_runtime_config
   SET infinitepay_handle = 'getsemani-gsa',
       updated_at = now()
 WHERE config_key = 'default';
