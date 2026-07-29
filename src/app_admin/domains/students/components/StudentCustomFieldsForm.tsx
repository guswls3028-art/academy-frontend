import type {
  ClientStudentCustomFieldDefinition,
  StudentCustomFieldValue,
  StudentCustomFieldValues,
} from "../api/students.api";

type Props = {
  definitions: ClientStudentCustomFieldDefinition[];
  values: StudentCustomFieldValues;
  onChange: (key: string, value: StudentCustomFieldValue) => void;
  disabled?: boolean;
};

export default function StudentCustomFieldsForm({
  definitions,
  values,
  onChange,
  disabled = false,
}: Props) {
  const activeDefinitions = definitions.filter((definition) => definition.active);
  if (activeDefinitions.length === 0) return null;

  return (
    <div className="modal-form-group modal-form-group--neutral">
      <span className="modal-section-label">맞춤 정보</span>
      {activeDefinitions.map((definition) => {
        const value = values[definition.key];
        const commonProps = {
          id: `student-custom-field-${definition.key}`,
          name: `custom:${definition.key}`,
          disabled,
          "aria-label": definition.label,
        };

        return (
          <label
            key={definition.key}
            htmlFor={commonProps.id}
            className="grid gap-1.5"
          >
            <span className="modal-phone-label">{definition.label}</span>
            {definition.fieldType === "select" ? (
              <select
                {...commonProps}
                className="ds-select"
                value={value == null ? "" : String(value)}
                onChange={(event) => onChange(definition.key, event.target.value)}
              >
                <option value="">선택 안 함</option>
                {definition.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                {...commonProps}
                className="ds-input"
                type={
                  definition.fieldType === "number"
                    ? "number"
                    : definition.fieldType === "date"
                      ? "date"
                      : "text"
                }
                value={value == null ? "" : String(value)}
                onChange={(event) => onChange(definition.key, event.target.value)}
                placeholder={`${definition.label} (선택)`}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
