import express from 'express';
import { CommentController } from '../controllers/CommentController.js';
import { checkCommentAuthorization } from '../middleware/utils/authorization.js';

/** Routes for public access to comments */
export const commentOpenRouter = express.Router({ mergeParams: true });

/** Routes for authenticated users to manage comments */
export const commentRestrictedRouter = express.Router({ mergeParams: true });

commentOpenRouter.get('/:id/replies', async (req, res) => {
  const { id } = req.params;
  const { page, limit } = req.query;
  const userId = req.userId;

  const result = await CommentController.getChildrenComments(
    id,
    page,
    limit,
    userId
  );
  res.json(result);
});

commentRestrictedRouter.post('/', async (req, res) => {
  const { memeId } = req.params;
  const { content, parentId } = req.body;
  const userId = req.userId;

  if (!memeId || !content) {
    throw { status: 400, message: 'Meme ID and content are required' };
  }

  const comment = await CommentController.createComment(
    memeId,
    userId,
    content,
    parentId
  );
  res.status(201).json(comment);
});

commentRestrictedRouter.put(
  '/:id',
  checkCommentAuthorization,
  async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      throw { status: 400, message: 'Content is required' };
    }

    const updatedComment = await CommentController.updateComment(
      id,
      req.userId,
      content
    );
    res.json(updatedComment);
  }
);

commentRestrictedRouter.delete(
  '/:id',
  checkCommentAuthorization,
  async (req, res) => {
    const { id } = req.params;
    if (!id) {
      throw { status: 400, message: 'Comment ID is required' };
    }

    await CommentController.deleteComment(id, req.userId);
    res.status(204).send();
  }
);

/** ------------------------ VOTES ------------------------- */
commentRestrictedRouter.put('/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { isUpvote } = req.body;
  const userId = req.userId; // Assuming user ID is set in req.userId
  if (!userId) {
    throw { status: 401, message: 'Unauthorized' };
  }
  if (!id) {
    throw { status: 400, message: 'Comment ID is required' };
  }
  if (typeof isUpvote !== 'boolean') {
    throw { status: 400, message: 'isUpvote must be a boolean' };
  }

  const updatedComment = await CommentController.voteComment(
    id,
    userId,
    isUpvote
  );
  res.json(updatedComment);
});

commentRestrictedRouter.delete('/:id/vote', async (req, res) => {
  const { id } = req.params;

  const userId = req.userId; // Assuming user ID is set in req.userId
  if (!userId) {
    throw { status: 401, message: 'Unauthorized' };
  }
  if (!id) {
    throw { status: 400, message: 'Comment ID is required' };
  }

  const updatedComment = await CommentController.unvoteComment(id, userId);
  res.json(updatedComment);
});
