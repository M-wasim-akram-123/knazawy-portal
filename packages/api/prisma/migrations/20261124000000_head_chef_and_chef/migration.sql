-- The kitchen lead becomes the head chef, who also approves recipes. Existing accounts keep their access.
ALTER TYPE "UserRole" RENAME VALUE 'KITCHEN_LEAD' TO 'HEAD_CHEF';

-- A chef can see recipes and orders but changes nothing.
ALTER TYPE "UserRole" ADD VALUE 'CHEF' AFTER 'HEAD_CHEF';
