import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
  /** UI de fallback opcional. Se omitido, usa o fallback padrão do sistema. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  declare readonly props: Readonly<Props>;
  declare setState: Component<Props, State>['setState'];

  public state: State = {
    hasError: false,
    errorMsg: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message + '\n' + (error.stack || '') };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // TODO: Integrar com Sentry/Logger externo em produção
    console.error("[ErrorBoundary] Erro não tratado capturado:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMsg: '' });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-lg w-full text-center bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-10">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-red-600 font-black text-xl mb-2 uppercase tracking-wider">Algo deu errado</h1>
            <p className="text-neutral-500 text-sm mb-6">
              Ocorreu um erro inesperado neste módulo. Você pode tentar novamente sem perder seus dados em outras áreas.
            </p>
            <details className="text-left mb-6">
              <summary className="text-xs font-bold text-neutral-400 uppercase tracking-widest cursor-pointer hover:text-neutral-600 transition-colors">
                Detalhes Técnicos
              </summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-neutral-500 bg-neutral-50 p-4 rounded-xl border border-neutral-100 overflow-auto max-h-[200px] font-mono">
                {this.state.errorMsg}
              </pre>
            </details>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-6 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
