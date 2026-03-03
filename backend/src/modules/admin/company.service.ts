import { PrismaClient } from '@prisma/client';

export async function getCompanyInfo(prisma: PrismaClient) {
  // Singleton pattern: there should be exactly one CompanyInfo record
  const company = await prisma.companyInfo.findFirst();

  if (!company) {
    return null;
  }

  return {
    id: company.id,
    name: company.name,
    nip: company.nip,
    address: company.address,
    city: company.city,
    postalCode: company.postalCode,
    updatedAt: company.updatedAt.toISOString(),
  };
}

export async function updateCompanyInfo(
  prisma: PrismaClient,
  data: {
    name?: string;
    nip?: string;
    address?: string;
    city?: string;
    postalCode?: string;
  }
) {
  // Find the existing singleton record
  const existing = await prisma.companyInfo.findFirst();

  if (!existing) {
    // If no company record exists yet, create one (requires all fields)
    const company = await prisma.companyInfo.create({
      data: {
        name: data.name ?? '',
        nip: data.nip ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        postalCode: data.postalCode ?? '',
      },
    });

    return {
      id: company.id,
      name: company.name,
      nip: company.nip,
      address: company.address,
      city: company.city,
      postalCode: company.postalCode,
      updatedAt: company.updatedAt.toISOString(),
    };
  }

  // Update the existing record
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nip !== undefined) updateData.nip = data.nip;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;

  const company = await prisma.companyInfo.update({
    where: { id: existing.id },
    data: updateData,
  });

  return {
    id: company.id,
    name: company.name,
    nip: company.nip,
    address: company.address,
    city: company.city,
    postalCode: company.postalCode,
    updatedAt: company.updatedAt.toISOString(),
  };
}
