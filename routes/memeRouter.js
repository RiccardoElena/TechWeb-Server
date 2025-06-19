import express from 'express';
import { MemeController } from '../controllers/MemeController.js';
import { checkMemeAuthorization } from '../middleware/utils/authorization.js';
import { uploader } from '../data/local/multerStorage/uploader.js';
import 'dotenv/config.js';

/** Routes for public access to memes */
export const memeOpenRouter = express.Router();

/** Routes for authenticated users to manage memes */
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
  const { page, limit, title, tags, sortedBy, sortDirection, userId } =
    req.query;

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
    sortDirection.toUpperCase(),
    userId,
    req.userId // Assuming user ID is set in req.userId by extractUserId middleware
  );
  res.json(memes);
});

/**
 * @swagger
 *  /memes/{id}:
 *    get:
 *      description: Get a specific meme by ID
 *      produces:
 *        - application/json
 *      parameters:
 *        - name: id
 *          in: path
 *          required: true
 *          description: The ID of the meme to retrieve
 *          schema:
 *            type: string
 *      responses:
 *        200:
 *          description: Meme object
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  id:
 *                    type: string
 *                    example: 1
 *                  title:
 *                    type: string
 *                    example: Funny Meme
 *                  imageUrl:
 *                    type: string
 *                    example: http://example.com/meme.jpg
 *                  createdAt:
 *                    type: string
 *                    format: date-time
 *                    example: 2023-10-01T12:00:00Z
 *                  userId:
 *                    type: string
 *                    example: 12345
 *                  userName:
 *                    type: string
 *                    example: Kyle
 *        404:
 *          description: Meme not found
 *        500:
 *          description: Internal server error
 */
memeOpenRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { commentsPage, commentsLimit } = req.query;
  const meme = await MemeController.getMemeById(
    id,
    commentsPage,
    commentsLimit,
    req.userId // Assuming user ID is set in req.userId by extractUserId middleware
  );
  res.json(meme);
});

memeOpenRouter.get('/memeOfTheDay', async (req, res) => {
  const memeId = await MemeController.getMemeOfTheDayId();
  if (!memeId) {
    throw { status: 404, message: 'Meme of the day not found' };
  }
  const meme = await MemeController.getMemeById(memeId, 0, 20, req.userId);
  res.json(meme);
});

memeRestrictedRouter.post('/', uploader.single('file'), async (req, res) => {
  // this has to change when we implement file upload
  const { filename: fileName } = req.file;
  const filePath = `http://localhost:${process.env.PORT}/uploads/${fileName}`; // Adjust this based on your server setup

  const { title, description, tags } = req.body;
  console.log(title, description, tags, fileName, filePath);
  const userId = req.userId; // Assuming user ID is set in req.userId by extractUserId middleware

  const meme = await MemeController.createMeme(
    { title, description, tags },
    fileName,
    filePath,
    userId
  );
  res.status(201).json(meme);
});

memeRestrictedRouter.put('/:id', checkMemeAuthorization, async (req, res) => {
  const { id } = req.params;
  // Assuming permissions are checked in some middleware
  const updatedMeme = await MemeController.updateMeme(id, req.body, req.userId);
  res.json(updatedMeme);
});

memeRestrictedRouter.delete(
  '/:id',
  checkMemeAuthorization,
  async (req, res) => {
    const { id } = req.params;
    if (!id) {
      throw { status: 400, message: 'Meme ID is required' };
    }
    // Assuming permissions are checked in some middleware
    await MemeController.deleteMeme(id);
    res.status(20).send();
  }
);

/* ------------------------ VOTES ------------------------- */
memeRestrictedRouter.put('/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { isUpvote } = req.body;
  const userId = req.userId; // Assuming user ID is set in req.userId
  if (!userId) {
    throw { status: 401, message: 'Unauthorized' };
  }
  if (!id) {
    throw { status: 400, message: 'Meme ID is required' };
  }
  if (typeof isUpvote !== 'boolean') {
    throw { status: 400, message: 'isUpvote must be a boolean' };
  }
  const updatedMeme = await MemeController.voteMeme(id, userId, isUpvote);
  res.json(updatedMeme);
});

memeRestrictedRouter.delete('/:id/vote', async (req, res) => {
  const { id } = req.params;

  const userId = req.userId; // Assuming user ID is set in req.userId
  if (!userId) {
    throw { status: 401, message: 'Unauthorized' };
  }
  if (!id) {
    throw { status: 400, message: 'Meme ID is required' };
  }
  const updatedMeme = await MemeController.unvoteMeme(id, userId);
  res.json(updatedMeme);
});
