export default function DemandChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500">Sem dados de demanda</div>;
  }

  const maxDemand = Math.max(...data.map(d => d.operadoresRecomendados || 0));

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-600">
        <p className="text-sm text-blue-800">
          📊 Dimensionamento por hora (Erlang-C)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((item, idx) => (
          <div key={idx} className="card">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold">{item.hora}</h4>
              <span className="text-2xl font-bold text-blue-600">
                {item.operadoresRecomendados}
              </span>
            </div>

            {/* Barra de visualização */}
            <div className="mb-3">
              <div className="bg-gray-200 rounded h-6 overflow-hidden">
                <div
                  className="bg-blue-600 h-full"
                  style={{
                    width: `${(item.operadoresRecomendados / maxDemand) * 100}%`
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-600">Clientes/h</p>
                <p className="font-semibold">{item.clientes}</p>
              </div>
              <div>
                <p className="text-gray-600">Tempo médio</p>
                <p className="font-semibold">{item.tempoMedioMin}min</p>
              </div>
              <div>
                <p className="text-gray-600">Fila esperada</p>
                <p className={`font-semibold ${
                  item.filaMin <= 3 ? 'text-green-600' :
                  item.filaMin <= 5 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {item.filaMin}min
                </p>
              </div>
              <div>
                <p className="text-gray-600">Utilização</p>
                <p className="font-semibold">{item.utilizacao}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
