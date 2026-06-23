export default function ScheduleView({ schedule, periodo }) {
  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-600">
        <p className="text-sm text-blue-800">
          📅 <strong>{periodo}</strong>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left font-semibold">Colaborador</th>
              {dias.map((dia, i) => (
                <th key={i} className="border p-3 text-center font-semibold text-sm">
                  {dia}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(schedule || {}).map(([nome, shifts]) => (
              <tr key={nome} className="hover:bg-gray-50">
                <td className="border p-3 font-medium">{nome}</td>
                {shifts.map((shift, i) => (
                  <td key={i} className="border p-3 text-center">
                    {shift === 'Folga' ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                        Folga
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        {shift}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="card">
          <p className="text-gray-600 text-sm">Total Colaboradores</p>
          <p className="text-2xl font-bold text-blue-600">
            {Object.keys(schedule || {}).length}
          </p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Regime</p>
          <p className="text-2xl font-bold text-green-600">6x1</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Horas Semanais</p>
          <p className="text-2xl font-bold text-purple-600">44h</p>
        </div>
      </div>
    </div>
  );
}
