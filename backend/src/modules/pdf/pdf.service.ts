import { PrismaClient } from '@prisma/client';

/**
 * Generate a PDF document for a delegation.
 *
 * STUB: Returns a placeholder buffer.
 * Full PDFKit implementation will be added in Etap 7 (see docs/PDF_TEMPLATE.md).
 */
export async function generateDelegationPdf(
  prisma: PrismaClient,
  delegationId: string,
  userId: string,
  userRole: string
): Promise<Buffer> {
  // Verify the delegation exists
  const delegation = await prisma.delegation.findUnique({
    where: { id: delegationId },
    include: {
      user: { include: { profile: true } },
      days: { orderBy: { dayNumber: 'asc' } },
      additionalCosts: true,
      mileageDetails: true,
      transportReceipts: true,
    },
  });

  if (!delegation) {
    throw new Error('DELEGATION_NOT_FOUND');
  }

  // Authorization: user can only access their own delegations, admin can access all
  if (userRole !== 'ADMIN' && delegation.userId !== userId) {
    throw new Error('FORBIDDEN');
  }

  // Fetch company info for the PDF header
  const companyInfo = await prisma.companyInfo.findFirst();

  // TODO: Replace with full PDFKit generation (Etap 7)
  // See docs/PDF_TEMPLATE.md for layout specification
  const placeholderText = [
    'PDF generation coming soon',
    '',
    `Delegation ID: ${delegation.id}`,
    `User: ${delegation.user.profile?.firstName ?? ''} ${delegation.user.profile?.lastName ?? ''}`,
    `Destination: ${delegation.destination}`,
    `Purpose: ${delegation.purpose}`,
    `Status: ${delegation.status}`,
    `Company: ${companyInfo?.name ?? 'N/A'}`,
  ].join('\n');

  return Buffer.from(placeholderText, 'utf-8');
}
