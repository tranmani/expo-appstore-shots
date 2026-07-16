/**
 * A screen that reaches for a name its stub does not have — on purpose.
 *
 * Not part of any run: one test points at it to prove the tool *reports* this,
 * because the reporting is the whole feature and it was previously untested. The
 * assertion that no import is undefined passes trivially when the collector is
 * deleted (an empty list filters to an empty list), so something has to make a
 * warning actually appear.
 *
 * The namespace import is the point. A named import of a missing export is a
 * hard error and stops the run; through a namespace it is only a warning, and
 * `undefined` at runtime — which is the shape that ships a broken screen.
 */
import * as Notifications from 'expo-notifications'

export default function UndefinedImport() {
  // There is no such API, and there never was.
  void (Notifications as Record<string, unknown>).definitelyNotAnExport
  return null
}
