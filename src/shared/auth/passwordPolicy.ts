export const PASSWORD_MIN_LENGTH = 4;

export function isPasswordChangeReady(
  currentPassword: string,
  newPassword: string,
  confirmation: string,
): boolean {
  return (
    currentPassword.length > 0 &&
    newPassword.length >= PASSWORD_MIN_LENGTH &&
    newPassword !== currentPassword &&
    confirmation.length > 0 &&
    newPassword === confirmation
  );
}

export function isPasswordConfirmationReady(
  password: string,
  confirmation: string,
): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    confirmation.length > 0 &&
    password === confirmation
  );
}

const TEMP_PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const TEMP_PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const TEMP_PASSWORD_DIGITS = "23456789";
const TEMP_PASSWORD_ALL = `${TEMP_PASSWORD_LOWER}${TEMP_PASSWORD_UPPER}${TEMP_PASSWORD_DIGITS}`;

function secureIndex(max: number): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("안전한 비밀번호 생성 기능을 사용할 수 없습니다.");
  }
  const values = new Uint32Array(1);
  const acceptedRange = Math.floor(0x1_0000_0000 / max) * max;
  do {
    cryptoApi.getRandomValues(values);
  } while (values[0] >= acceptedRange);
  return values[0] % max;
}

function secureCharacter(characters: string): string {
  return characters[secureIndex(characters.length)];
}

export function generateTemporaryPassword(length = 12): string {
  const safeLength = Math.max(length, PASSWORD_MIN_LENGTH);
  const characters = [
    secureCharacter(TEMP_PASSWORD_LOWER),
    secureCharacter(TEMP_PASSWORD_UPPER),
    secureCharacter(TEMP_PASSWORD_DIGITS),
  ];

  while (characters.length < safeLength) {
    characters.push(secureCharacter(TEMP_PASSWORD_ALL));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}
