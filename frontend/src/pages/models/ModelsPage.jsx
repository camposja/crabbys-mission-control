import { useQuery } from "@tanstack/react-query";
import { modelsApi } from "../../api/models";
import { Cpu, Zap, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import ErrorBoundary from "../../components/ui/ErrorBoundary";

const PROVIDER_COLORS = {
  anthropic: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  openai:    "text-green-400 bg-green-500/10 border-green-500/20",
  ollama:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
  groq:      "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

function providerClass(name) {
  return PROVIDER_COLORS[name?.toLowerCase()] || "text-gray-400 bg-gray-800 border-gray-700";
}

function ModelCard({ model, isLive }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{model.name || model.id}</p>
          {model.id !== model.name && (
            <p className="text-xs text-gray-600 truncate font-mono">{model.id}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 size={11} /> live
            </span>
          )}
          {model.reasoning && (
            <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded">
              reasoning
            </span>
          )}
        </div>
      </div>

      <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border mb-3 ${providerClass(model.provider)}`}>
        {model.provider}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        {model.context_window && (
          <div>
            <span className="text-gray-600">Context</span>
            <p className="text-gray-400">{(model.context_window / 1000).toFixed(0)}k tokens</p>
          </div>
        )}
        {model.max_tokens && (
          <div>
            <span className="text-gray-600">Max out</span>
            <p className="text-gray-400">{(model.max_tokens / 1000).toFixed(0)}k tokens</p>
          </div>
        )}
        {model.cost?.input != null && (
          <div>
            <span className="text-gray-600">In</span>
            <p className="text-gray-400">${model.cost.input}/M</p>
          </div>
        )}
        {model.cost?.output != null && (
          <div>
            <span className="text-gray-600">Out</span>
            <p className="text-gray-400">${model.cost.output}/M</p>
          </div>
        )}
        {model.input_types?.length > 0 && (
          <div className="col-span-2">
            <span className="text-gray-600">Inputs</span>
            <p className="text-gray-400">{model.input_types.join(", ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelsInner() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["models"],
    queryFn:  modelsApi.getAll,
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading models…</div>;

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-3">Models</h1>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-400">
          Could not load model configuration.
        </div>
      </div>
    );
  }

  const configured  = data?.configured || [];
  const gatewayList = Array.isArray(data?.gateway) ? data.gateway : [];
  const defaults    = data?.defaults || {};

  // Build set of live model ids for badge
  const liveIds = new Set(gatewayList.map(m => m.id || m.name));

  // Group configured by provider
  const byProvider = configured.reduce((acc, m) => {
    const p = m.provider || "other";
    if (!acc[p]) acc[p] = [];
    acc[p].push(m);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">Models</h1>
      <p className="text-gray-400 text-sm mb-6">
        {configured.length} configured · {gatewayList.length} live from gateway
      </p>

      {/* Default models banner */}
      {Object.keys(defaults).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Zap size={11} /> Agent Defaults
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(defaults).map(([role, modelId]) => (
              <div key={role} className="text-sm">
                <span className="text-gray-500 capitalize">{role}: </span>
                <span className="text-orange-400 font-mono text-xs">{modelId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configured models by provider */}
      {Object.keys(byProvider).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Cpu size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No models configured</p>
          <p className="text-xs mt-1">Add models to ~/.openclaw/openclaw.json</p>
        </div>
      ) : (
        Object.entries(byProvider).map(([provider, models]) => (
          <div key={provider} className="mb-6">
            <p className={`text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-gray-800 pb-2 ${providerClass(provider).split(" ")[0]}`}>
              <Cpu size={11} /> {provider}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {models.map((m, i) => (
                <ModelCard key={m.id || i} model={m} isLive={liveIds.has(m.id)} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Gateway-only models */}
      {gatewayList.length > 0 && configured.length === 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-gray-800 pb-2">
            <Eye size={11} /> Live from Gateway
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {gatewayList.map((m, i) => (
              <div key={m.id || i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <p className="text-sm font-medium text-white">{m.name || m.id}</p>
                <p className="text-xs text-gray-600 font-mono mt-0.5">{m.id}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModelsPage() {
  return (
    <ErrorBoundary>
      <ModelsInner />
    </ErrorBoundary>
  );
}
