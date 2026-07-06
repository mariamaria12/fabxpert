import { z } from 'zod';

const optionalString = z.string().optional();

const optionalEmail = z
  .union([z.string().email(), z.literal('')])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  taxCode: optionalString,
  tradeRegistryNumber: optionalString,
  registeredAddress: optionalString,
  phone: optionalString,
  deliveryAddress: optionalString,
  legalRepresentative: optionalString,
  email: optionalEmail,
  contactPerson: optionalString,
  contactPersonPhone: optionalString,
});

export const updateCompanySchema = createCompanySchema.partial().refine(
  (data) => data.name === undefined || data.name.trim().length > 0,
  { message: 'Name cannot be empty', path: ['name'] },
);

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

/** API-facing Company shape — deletedAt is an internal implementation detail. */
export type CompanyDto = {
  id: string;
  name: string;
  taxCode: string | null;
  tradeRegistryNumber: string | null;
  registeredAddress: string | null;
  phone: string | null;
  deliveryAddress: string | null;
  legalRepresentative: string | null;
  email: string | null;
  contactPerson: string | null;
  contactPersonPhone: string | null;
  createdAt: string;
  updatedAt: string;
};
