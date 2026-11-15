function phoneCharacters(value: string) {
  return value.replace(/[^0-9+ ().-]/g, "").replace(/(?!^)\+/g, "");
}

export function readPhoneInput(input: HTMLInputElement) {
  const { value, selectionStart, selectionEnd } = input;
  const phone = phoneCharacters(value);
  if (phone !== value) {
    input.value = phone;
    if (selectionStart !== null && selectionEnd !== null)
      input.setSelectionRange(
        phoneCharacters(value.slice(0, selectionStart)).length,
        phoneCharacters(value.slice(0, selectionEnd)).length,
      );
  }
  return phone;
}
