// Text in **bold**, as notices, guides and Nexo write trophy names. A name can carry asterisks of its
// own ("T***, rabeta, droga e grana"): the closing ** is never touching another asterisk, so the
// bold runs to the end of the name instead of stopping inside it.
export const BOLD = /\*\*(.+?)(?<!\*)\*\*(?!\*)/g
