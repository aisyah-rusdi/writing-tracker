const fmt = (n) => n.toLocaleString('en-US')

const BAR_AREA = 170 // px for the tallest bar
const MIN_SCALE = 1000 // so a quiet week doesn't make one small day look huge

// bars:   [{ date, label, total, parts: [{ id, name, colour, words }], future }]
//         parts are in picker order, drawn bottom to top.
// legend: [{ id, name, colour }]
export default function WeekChart({ bars, legend }) {
  const max = Math.max(MIN_SCALE, ...bars.map((b) => b.total))

  return (
    <div className="card week-chart">
      <div className="chart">
        {bars.map((b) => {
          const summary = b.total
            ? `${b.label}: ${fmt(b.total)} words`
            : b.future
              ? `${b.label}: still to come`
              : `${b.label}: not logged`
          return (
            <div className="col" key={b.date} role="group" aria-label={summary}>
              {b.total ? (
                <>
                  <span className="num">{fmt(b.total)}</span>
                  <div className="bars" style={{ height: `${(b.total / max) * BAR_AREA}px` }}>
                    {b.parts.map((p) => (
                      <div
                        key={p.id}
                        title={`${p.name}: ${fmt(p.words)}`}
                        style={{ height: `${(p.words / b.total) * 100}%`, background: p.colour }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className={'nolog' + (b.future ? ' nolog--future' : '')} aria-hidden="true">
                  {b.future ? '' : 'not logged'}
                </div>
              )}
              <span className="mut" aria-hidden="true">
                {b.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="legend mut">
        {legend.map((p) => (
          <span key={p.id}>
            <span className="dot" style={{ background: p.colour }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  )
}