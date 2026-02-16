import type { ZodSchema } from 'zod';

export type ValidationResult<T> = {
    success: boolean;
    data?: T;
    errors?: Record<string, string>;
};

export function validateForm<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);

    if (result.success) {
        return {
            success: true,
            data: result.data,
        };
    }

    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
        // defaults to the last path element as key
        const path = issue.path[issue.path.length - 1];
        if (path) {
            errors[path.toString()] = issue.message;
        }
    });

    return {
        success: false,
        errors,
    };
}

export function validateField<T>(schema: ZodSchema<T>, field: keyof T, value: unknown): string | null {
    // Create a partial schema for just this field
    // This approach depends on how the schema is constructed. 
    // For simple object schemas it works.

    // A robust way to validate a single field with Zod is to extract the shape if possible
    // or use pick/omit. 

    if ('shape' in schema) {
        // @ts-ignore - assuming ZodObject
        const fieldSchema = schema.shape[field];
        if (fieldSchema) {
            const result = fieldSchema.safeParse(value);
            if (!result.success) {
                return result.error.issues[0].message;
            }
        }
    }

    return null;
}
