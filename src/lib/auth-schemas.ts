import { z } from 'zod'

export const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(1, 'Enter your name'),
})

export const updateNameSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Password must be at least 8 characters'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  })

export const deleteAccountSchema = z.object({
  password: z.string().min(8, 'Enter your password to confirm'),
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type UpdateNameValues = z.infer<typeof updateNameSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>
