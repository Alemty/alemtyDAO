
export function isAdmin(address: string) {
  // temporal / hardcoded
  const ADMINS = [
    "0x1111111111111111111111111111111111111111"
  ];
  return ADMINS.includes(address.toLowerCase());
}
