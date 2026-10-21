export default function ThemeSwitcher({ value, onChange }) {
  return (
    <label className="theme-switcher">
      <span className="material-icons" aria-hidden="true">palette</span>
      <span className="theme-switcher-label">Izskats</span>
      <select aria-label="Izskats" value={value} onChange={event => onChange(event.target.value)}>
        <option value="violet">Violets</option>
        <option value="simple">Vienkāršs</option>
        <option value="ha">Home Assistant</option>
      </select>
    </label>
  );
}
