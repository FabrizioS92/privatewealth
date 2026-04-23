import { labelText } from "@/lib/correlation-math";

interface Props {
  tickers: string[];
  matrix: number[][];
  pvalues: number[][];
}

// Map r in [-1, +1] to background style. Uses theme tokens via color-mix.
function cellStyle(r: number): React.CSSProperties {
  if (r >= 0.7) return { backgroundColor: "color-mix(in oklab, var(--chart-2) 80%, white)", color: "white" };
  if (r >= 0.4) return { backgroundColor: "color-mix(in oklab, var(--chart-2) 45%, white)" };
  if (r > -0.1) return { backgroundColor: "color-mix(in oklab, var(--muted) 80%, white)" };
  if (r >= -0.4) return { backgroundColor: "color-mix(in oklab, var(--coral) 35%, white)" };
  return { backgroundColor: "color-mix(in oklab, var(--coral) 75%, white)", color: "white" };
}

export function CorrelationHeatmap({ tickers, matrix, pvalues }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th className="w-24" />
            {tickers.map((t) => (
              <th key={t} className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((row, i) => (
            <tr key={row}>
              <th className="pr-2 text-right text-xs font-semibold text-muted-foreground">{row}</th>
              {tickers.map((col, j) => {
                if (i === j) {
                  return (
                    <td
                      key={col}
                      className="rounded-2xl bg-secondary/40 px-2 py-3 text-center text-xs text-muted-foreground"
                    >
                      –
                    </td>
                  );
                }
                const r = matrix[i][j];
                const p = pvalues[i][j];
                const significant = p < 0.05;
                return (
                  <td
                    key={col}
                    style={cellStyle(r)}
                    className="rounded-2xl px-2 py-3 text-center"
                    title={`${row} vs ${col}: r = ${r.toFixed(2)} ${significant ? "(affidabile)" : "(pochi dati)"}`}
                  >
                    <div className="text-sm font-semibold tabular-nums">{r.toFixed(2)}</div>
                    <div className="text-[10px] font-medium opacity-90">{labelText(r)}</div>
                    <div className="mt-0.5 text-[10px] opacity-90">
                      {significant ? "✅ affidabile" : "⚠️ pochi dati"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
