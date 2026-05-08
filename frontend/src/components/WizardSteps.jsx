import { Check } from 'lucide-react';

/**
 * WizardSteps — horizontal step indicator for multi-step flows.
 *
 * @param {Array<{label: string}>} steps
 * @param {number}                 currentStep   1-based index of the active step
 * @param {(step: number) => void} onStepClick   called when a completed step is clicked
 */
export function WizardSteps({ steps, currentStep, onStepClick }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const number    = i + 1;
        const completed = number < currentStep;
        const active    = number === currentStep;
        const upcoming  = number > currentStep;

        return (
          <div key={number} className="flex items-center">
            {/* Step bubble */}
            <button
              type="button"
              disabled={upcoming}
              onClick={() => completed && onStepClick?.(number)}
              className="flex items-center gap-2.5 group"
              style={{ cursor: completed ? 'pointer' : 'default' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors"
                style={{
                  backgroundColor: completed
                    ? 'var(--brand)'
                    : active
                      ? 'var(--brand)'
                      : 'var(--bg-raised)',
                  color: completed || active
                    ? '#fff'
                    : 'var(--text-muted)',
                  border: upcoming ? '1.5px solid var(--border-strong)' : 'none',
                }}
              >
                {completed ? <Check className="w-3.5 h-3.5" /> : number}
              </div>

              <span
                className="text-sm font-medium hidden sm:block"
                style={{
                  color: active
                    ? 'var(--text-primary)'
                    : completed
                      ? 'var(--brand)'
                      : 'var(--text-muted)',
                }}
              >
                {step.label}
              </span>
            </button>

            {/* Connector line (not after last step) */}
            {i < steps.length - 1 && (
              <div
                className="mx-3 h-px flex-shrink-0"
                style={{
                  width: '40px',
                  backgroundColor: completed ? 'var(--brand)' : 'var(--border-default)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
