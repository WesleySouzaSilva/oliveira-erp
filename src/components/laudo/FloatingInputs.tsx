import { HelpCircle } from "lucide-react";

export function FloatingInput({
  label,
  required,
  tooltip,
  type = "text",
  ...props
}: {
  label: string;
  required?: boolean;
  tooltip?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="floating-label-group">
      <input type={type} placeholder=" " {...props} />
      <label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {tooltip && (
          <span className="inline-block ml-1 text-muted-foreground" title={tooltip}>
            <HelpCircle className="w-3 h-3 inline" />
          </span>
        )}
      </label>
    </div>
  );
}

export function FloatingSelect({
  label,
  required,
  options,
  ...props
}: {
  label: string;
  required?: boolean;
  options: { value: string; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="floating-label-group">
      <select {...props} defaultValue="">
        <option value="" disabled hidden> </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
    </div>
  );
}

export function FloatingTextarea({
  label,
  required,
  tooltip,
  ...props
}: {
  label: string;
  required?: boolean;
  tooltip?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="floating-label-group">
      <textarea placeholder=" " {...props} />
      <label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {tooltip && (
          <span className="inline-block ml-1 text-muted-foreground" title={tooltip}>
            <HelpCircle className="w-3 h-3 inline" />
          </span>
        )}
      </label>
    </div>
  );
}
