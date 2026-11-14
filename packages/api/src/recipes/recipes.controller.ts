import type { Actor, RecipeRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateRecipeDto, UpdateRecipeDto } from './recipes.dto';
import { RecipesService } from './recipes.service';

@ApiTags('Recipes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  list(
    @CurrentUser() actor: Actor,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<RecipeRecord[]> {
    return this.recipes.list(actor, includeArchived === 'true');
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateRecipeDto): Promise<RecipeRecord> {
    return this.recipes.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateRecipeDto,
  ): Promise<RecipeRecord> {
    return this.recipes.update(actor, id, body);
  }

  @Post(':id/approve')
  approve(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<RecipeRecord> {
    return this.recipes.approve(actor, id);
  }
}
