/**
 * Blocking loader for the assembly import: a torch runs a seam, laying a
 * glowing bead behind it while sparks scatter. Reading a project workbook takes
 * a second or two, and this says "working" without a spinner.
 *
 * Colors come from the --loader-* tokens in tokens.css. The bead, glow and
 * sparks stay warm in every theme — a spark is a physical thing.
 */
const SPARKS = [
  { sx: '26px', sy: '-20px', delay: '0s', size: 3 },
  { sx: '32px', sy: '4px', delay: '0.12s', size: 2 },
  { sx: '18px', sy: '22px', delay: '0.24s', size: 3 },
  { sx: '-14px', sy: '-18px', delay: '0.36s', size: 2 },
  { sx: '-22px', sy: '12px', delay: '0.48s', size: 2 },
  { sx: '10px', sy: '-28px', delay: '0.6s', size: 2 },
];

export interface WeldingLoaderProps {
  /** Line under the animation, e.g. "Se citește fișierul…". */
  label: string;
}

export function WeldingLoader({ label }: WeldingLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-5" role="status" aria-live="polite">
      <div className="weld-scene relative h-[110px] w-[200px]">
        <div className="absolute left-[62px] top-[68px] h-[7px] w-[76px] rounded-sm bg-[var(--loader-seam)]" />

        <div
          className="absolute left-[62px] top-[68px] h-[7px] rounded-sm bg-[linear-gradient(90deg,var(--loader-bead-start),var(--loader-bead-mid),var(--loader-bead-end))]"
          style={{ animation: 'weld-bead 2.4s ease-in-out infinite' }}
        />

        <div
          className="absolute left-[62px] top-0 h-full w-[1px]"
          style={{ animation: 'weld-travel 2.4s ease-in-out infinite' }}
        >
          <div
            className="absolute left-[-26px] top-[62px] size-[52px] rounded-full bg-[var(--loader-glow)] blur-xl"
            style={{ animation: 'weld-glow 0.5s ease-in-out infinite' }}
          />

          <div className="absolute left-[-3px] top-[16px] h-[42px] w-[7px] origin-bottom -rotate-[24deg] rounded-t-[3px] bg-[var(--loader-torch)]" />
          <div className="absolute left-[-1px] top-[52px] h-[14px] w-[3px] origin-bottom -rotate-[24deg] rounded-sm bg-[var(--loader-torch-tip)]" />

          <div
            className="absolute left-[-5px] top-[62px] size-[11px] rounded-full bg-[var(--loader-arc)] shadow-[0_0_14px_6px_var(--loader-glow-halo)]"
            style={{ animation: 'weld-arc 0.28s ease-in-out infinite' }}
          />

          {SPARKS.map((spark) => (
            <span
              key={spark.delay}
              className="absolute rounded-full bg-[var(--loader-spark)]"
              style={{
                left: 0,
                top: '66px',
                width: `${spark.size}px`,
                height: `${spark.size}px`,
                ['--sx' as string]: spark.sx,
                ['--sy' as string]: spark.sy,
                animation: `weld-spark 0.9s linear ${spark.delay} infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  );
}
