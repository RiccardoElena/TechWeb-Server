import express from 'express';
import { MemeController } from '../controllers/MemeController.js';
import {
  checkMemeAuthorization,
  enforceAuthentication,
} from '../middleware/utils/authorization.js';

export const memeOpenRouter = express.Router();

export const memeRestrictedRouter = express.Router();

// TODO: after proper testing with db start using middleware for file upload
/**
 * @swagger
 *  /memes:
 *    get:
 *      description: Get all memes
 *      produces:
 *        - application/json
 *      responses:
 *        200:
 *          description: List of memes
 *          content:
 *            application/json:
 *              schema:
 *                type: array
 *                items:
 *                  type: object
 *                  properties:
 *                    id:
 *                      type: string
 *                      example: 1
 *                    title:
 *                      type: string
 *                      example: Funny Meme
 *                    imageUrl:
 *                      type: string
 *                      example: http://example.com/meme.jpg
 *                    createdAt:
 *                      type: string
 *                      format: date-time
 *                      example: 2023-10-01T12:00:00Z
 *                    userId:
 *                      type: string
 *                      example: 12345
 *                    userName:
 *                      type: string
 *                      example: Kyle
 *    responses:
 *        500:
 *          description: Internal server error
 */
memeOpenRouter.get('/', async (req, res) => {
  const { page, limit, title, tags, sortedBy, sortDirection } = req.query;
  let parsedTags = [];
  if (tags) {
    parsedTags = Array.isArray(tags) ? tags : tags.split(',');
  }

  if (
    ![
      'createdAt',
      'upvotesNumber',
      'downvotesNumber',
      'commentsNumber',
    ].includes(sortedBy)
  ) {
    throw { status: 400, message: 'Invalid sortBy parameter' };
  }

  if (sortDirection && !['ASC', 'DESC'].includes(sortDirection.toUpperCase())) {
    throw { status: 400, message: 'Invalid sortDirection parameter' };
  }
  const memes = await MemeController.getMemesPage(
    page,
    limit,
    title,
    parsedTags,
    sortedBy,
    sortDirection.toUpperCase()
  );
  res.json(memes);
});

memeOpenRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { commentsPage, commentsLimit } = req.query;
  const meme = await MemeController.getMemeById(
    id,
    commentsPage,
    commentsLimit
  );
  res.json(meme);
});

memeRestrictedRouter.post('/', async (req, res) => {
  // this has to change when we implement file upload
  const { title, description, tags, fileName, originalFileName, filePath } =
    req.body;
  console.log('Received file upload:', {
    title,
    description,
    tags,
    fileName,
    originalFileName,
    filePath,
  });
  const userId = req.userId; // Assuming user ID is set in req.userId by enforceAuthentication middleware
  console.log('User ID:', userId);
  const meme = await MemeController.createMeme(
    { title, description, tags },
    fileName,
    originalFileName,
    filePath,
    userId
  );
  res.status(201).json(meme);
});

memeRestrictedRouter.put('/:id', checkMemeAuthorization, async (req, res) => {
  const { id } = req.params;
  // Assuming permissions are checked in some middleware
  const updatedMeme = await MemeController.updateMeme(id, req.body);
  res.json(updatedMeme);
});

memeRestrictedRouter.delete(
  '/:id',
  checkMemeAuthorization,
  async (req, res) => {
    const { id } = req.params;
    // Assuming permissions are checked in some middleware
    await MemeController.deleteMeme(id);
    res.status(204).send();
  }
);
