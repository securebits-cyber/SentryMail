/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Globaler Schalter für die Vor-Launch-Phase.
 *
 *  Solange die Firmengründung nicht abgeschlossen ist, werden alle Business-
 *  und Enterprise-Funktionen als „Coming Soon" markiert und noch nicht zum
 *  Kauf/zur Aktivierung angeboten. Nach Abschluss der Gründung hier auf
 *  ``false`` setzen — dann verschwinden sämtliche Coming-Soon-Marker wieder. */
export const COMING_SOON = true
