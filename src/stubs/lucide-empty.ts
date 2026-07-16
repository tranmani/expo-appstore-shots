/**
 * The app has no lucide-react-native; the tab bar falls back to dots and labels.
 *
 * The sentinel is the whole point of this file. Without it the tab bar cannot
 * tell "lucide is here and `House` is a typo" from "lucide is not here at all",
 * and it would report every configured icon as a name lucide does not have —
 * six confident, wrong findings about one plain fact.
 */
export const __shotsLucideMissing = true
