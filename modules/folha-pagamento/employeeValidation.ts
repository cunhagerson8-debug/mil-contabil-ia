export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function isValidCpf(value: string): boolean {
  if (!/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value.trim())) return false;
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const digitAt = (length: number) => {
    const sum = digits.slice(0, length).split("").reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0
    );
    return (sum * 10) % 11 % 10;
  };
  return digitAt(9) === Number(digits[9]) && digitAt(10) === Number(digits[10]);
}
