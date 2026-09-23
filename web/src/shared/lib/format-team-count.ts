export function formatTeamCount(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  const noun =
    lastTwoDigits >= 11 && lastTwoDigits <= 14
      ? 'команд'
      : lastDigit === 1
        ? 'команда'
        : lastDigit >= 2 && lastDigit <= 4
          ? 'команды'
          : 'команд'

  return `${count} ${noun}`
}
