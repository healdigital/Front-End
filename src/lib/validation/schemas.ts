import { z } from 'zod';

export const NEWSLETTER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
export const SEARCH_QUERY_PATTERN = /^[a-zA-Z0-9\s\-_'éèàùçêîôûëïü]*$/;

export const newsletterSchema = z.object({
    email: z
        .string({ required_error: "L'adresse email est requise." })
        .trim()
        .min(1, "L'adresse email est requise.")
        .max(254, "L'adresse email ne peut pas dépasser 254 caractères.")
        .regex(NEWSLETTER_EMAIL_PATTERN, "Veuillez entrer une adresse email valide."),
    consent: z
        .literal(true, {
            errorMap: () => ({ message: "Vous devez accepter la politique de confidentialité." }),
        }),
});

export const searchSchema = z.object({
    query: z
        .string({ required_error: 'La recherche est requise.' })
        .trim()
        .min(2, "La recherche doit contenir au moins 2 caractères.")
        .max(50, "La recherche ne peut pas dépasser 50 caractères.")
        .regex(SEARCH_QUERY_PATTERN, "La recherche contient des caractères non autorisés."),
});

export type NewsletterData = z.infer<typeof newsletterSchema>;
export type SearchData = z.infer<typeof searchSchema>;
