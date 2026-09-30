import React from "react";

interface FormErrorsProps {
    errors: string[];
    /** The list's class, for the form's own look. */
    className?: string;
    /** Each message's class. */
    itemClassName?: string;
    /** For the fields to point at with aria-describedby. */
    id?: string;
}

/**
 * A form's errors, read out by a screen reader as they appear (#122). Shown
 * only in the page, they were silent: nothing told someone who couldn't see
 * them that the form had been refused.
 *
 * The alert is a wrapper around the list rather than the list itself: role
 * "alert" on a <ul> takes its list role away, and leaves each <li> as an item
 * of no list at all.
 */
function FormErrors({ errors, className, itemClassName, id }: FormErrorsProps): React.JSX.Element | null {
    if (errors.length === 0) return null;
    return (
        <div role="alert" id={id}>
            <ul className={className}>
                {errors.map((error, idx) => (
                    <li key={idx} className={itemClassName}>{error}</li>
                ))}
            </ul>
        </div>
    );
}

export default FormErrors;
