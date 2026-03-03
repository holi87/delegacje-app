import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { generateDelegationPdf } from './pdf.service.js';

export async function pdfRoutes(app: FastifyInstance) {
  // GET /:id/pdf - generate and return PDF for a delegation
  app.get('/:id/pdf', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, role } = request.user;

    try {
      const pdfBuffer = await generateDelegationPdf(app.prisma, id, userId, role);

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="delegacja-${id}.pdf"`)
        .send(pdfBuffer);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'DELEGATION_NOT_FOUND') {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Delegacja nie znaleziona',
          });
        }
        if (error.message === 'FORBIDDEN') {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Brak uprawnień do tej delegacji',
          });
        }
      }

      app.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Błąd generowania PDF',
      });
    }
  });
}
