import { Currency } from "@/lib/graphql/generated"

export const MAX_INPUT_VALUE_LENGTH = 14
export const DEFAULT_CURRENCY: Currency = {
  __typename: "Currency",
  id: "USD",
  symbol: "$",
  name: "US Dollar",
  flag: "🇺🇸",
  fractionDigits: 2,
}
