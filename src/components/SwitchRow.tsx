interface SwitchRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-[#F3EFE6]">
          {label}
        </label>
        {description && (
          <p className="text-xs text-[#9CA3AE]">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
          checked
            ? 'border-[#E5A93C] bg-[#E5A93C]'
            : 'border-[#343C47] bg-[#252B33]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
            checked
              ? 'translate-x-6 bg-[#121417]'
              : 'translate-x-1 bg-[#9CA3AE]'
          }`}
        />
      </button>
    </div>
  );
}
