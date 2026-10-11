/**
 * Shared styling for the prominent "add / create" action boxes across the app
 * (Add a class, Add a student, Generate invoices, Run a scan, …). A black card
 * with white text so the primary create action on each page stands out from the
 * list of existing records below it.
 *
 * Apply to the add box's `<Card className={addBoxClass}>`. The descendant
 * utilities theme the form controls for the dark surface (labels, inputs,
 * selects, textareas, muted hints) and invert the submit button to white-on-
 * black so the call to action pops. Only use it on boxes whose single submit
 * button is the CTA - a box that also contains delete buttons (also
 * `type="submit"`) would have those inverted too.
 */
export const addBoxClass = [
  "border-neutral-800 bg-black text-white",
  "[&_label]:text-white",
  "[&_.text-muted-foreground]:text-neutral-400",
  "[&_input]:border-neutral-700 [&_input]:bg-neutral-900 [&_input]:text-white [&_input]:placeholder:text-neutral-500",
  "[&_select]:border-neutral-700 [&_select]:bg-neutral-900 [&_select]:text-white",
  "[&_textarea]:border-neutral-700 [&_textarea]:bg-neutral-900 [&_textarea]:text-white [&_textarea]:placeholder:text-neutral-500",
  "[&_button[type=submit]]:bg-white [&_button[type=submit]]:text-black [&_button[type=submit]]:shadow-xs [&_button[type=submit]]:hover:bg-neutral-200",
].join(" ");
