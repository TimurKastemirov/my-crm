import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { PipelineDto, PipelineStageDto } from '@crm/shared';
import { PipelineEntity } from './entities/pipeline.entity.js';
import { PipelineStageEntity } from './entities/pipeline-stage.entity.js';
import { DealEntity } from './entities/deal.entity.js';
import { DEFAULT_PIPELINE } from './default-pipeline.js';
import {
  CreatePipelineDto,
  CreateStageDto,
  UpdatePipelineDto,
  UpdateStageDto,
} from './dto/pipeline.dto.js';

@Injectable()
export class PipelinesService {
  constructor(
    @InjectRepository(PipelineEntity)
    private readonly pipelineRepo: Repository<PipelineEntity>,
    @InjectRepository(PipelineStageEntity)
    private readonly stageRepo: Repository<PipelineStageEntity>,
    @InjectRepository(DealEntity)
    private readonly dealRepo: Repository<DealEntity>,
  ) {}

  /** Default pipeline + stages when an organization is created (inside the register transaction). */
  async provisionDefault(manager: EntityManager, organizationId: string): Promise<void> {
    const pipelineRepo = manager.getRepository(PipelineEntity);
    const stageRepo = manager.getRepository(PipelineStageEntity);
    const pipeline = await pipelineRepo.save(
      pipelineRepo.create({ organizationId, name: DEFAULT_PIPELINE.name, isDefault: true, position: 0 }),
    );
    await stageRepo.save(
      DEFAULT_PIPELINE.stages.map((s, i) =>
        stageRepo.create({
          organizationId,
          pipelineId: pipeline.id,
          name: s.name,
          position: i,
          probability: s.probability,
          isWon: s.isWon,
          isLost: s.isLost,
        }),
      ),
    );
  }

  async listPipelines(organizationId: string): Promise<PipelineDto[]> {
    const pipelines = await this.pipelineRepo.find({
      where: { organizationId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    if (pipelines.length === 0) return [];
    const stages = await this.stageRepo.find({
      where: { organizationId },
      order: { position: 'ASC' },
    });
    const byPipeline = new Map<string, PipelineStageEntity[]>();
    for (const s of stages) {
      const list = byPipeline.get(s.pipelineId) ?? [];
      list.push(s);
      byPipeline.set(s.pipelineId, list);
    }
    return pipelines.map((p) => this.toPipelineDto(p, byPipeline.get(p.id) ?? []));
  }

  async createPipeline(organizationId: string, dto: CreatePipelineDto): Promise<PipelineDto> {
    const pipeline = await this.pipelineRepo.save(
      this.pipelineRepo.create({
        organizationId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        position: dto.position ?? 0,
      }),
    );
    return this.toPipelineDto(pipeline, []);
  }

  async updatePipeline(organizationId: string, id: string, dto: UpdatePipelineDto): Promise<PipelineDto> {
    const pipeline = await this.mustFindPipeline(organizationId, id);
    if (dto.name !== undefined) pipeline.name = dto.name;
    if (dto.isDefault !== undefined) pipeline.isDefault = dto.isDefault;
    if (dto.position !== undefined) pipeline.position = dto.position;
    await this.pipelineRepo.save(pipeline);
    const stages = await this.stageRepo.find({ where: { organizationId, pipelineId: id }, order: { position: 'ASC' } });
    return this.toPipelineDto(pipeline, stages);
  }

  async deletePipeline(organizationId: string, id: string): Promise<void> {
    const pipeline = await this.mustFindPipeline(organizationId, id);
    if (pipeline.isDefault) throw new ForbiddenException('Cannot delete the default pipeline');
    const deals = await this.dealRepo.count({ where: { organizationId, pipelineId: id }, withDeleted: true });
    if (deals > 0) throw new BadRequestException('The pipeline has deals — deletion is not allowed');
    await this.pipelineRepo.delete({ id }); // stages are deleted via cascade
  }

  // ---- stages ----

  async listStages(organizationId: string, pipelineId: string): Promise<PipelineStageDto[]> {
    await this.mustFindPipeline(organizationId, pipelineId);
    const stages = await this.stageRepo.find({
      where: { organizationId, pipelineId },
      order: { position: 'ASC' },
    });
    return stages.map((s) => this.toStageDto(s));
  }

  async createStage(organizationId: string, pipelineId: string, dto: CreateStageDto): Promise<PipelineStageDto> {
    await this.mustFindPipeline(organizationId, pipelineId);
    const stage = await this.stageRepo.save(
      this.stageRepo.create({
        organizationId,
        pipelineId,
        name: dto.name,
        position: dto.position ?? 0,
        probability: dto.probability ?? 0,
        isWon: dto.isWon ?? false,
        isLost: dto.isLost ?? false,
      }),
    );
    return this.toStageDto(stage);
  }

  async updateStage(organizationId: string, pipelineId: string, stageId: string, dto: UpdateStageDto): Promise<PipelineStageDto> {
    const stage = await this.mustFindStage(organizationId, pipelineId, stageId);
    if (dto.name !== undefined) stage.name = dto.name;
    if (dto.position !== undefined) stage.position = dto.position;
    if (dto.probability !== undefined) stage.probability = dto.probability;
    if (dto.isWon !== undefined) stage.isWon = dto.isWon;
    if (dto.isLost !== undefined) stage.isLost = dto.isLost;
    await this.stageRepo.save(stage);
    return this.toStageDto(stage);
  }

  async deleteStage(organizationId: string, pipelineId: string, stageId: string): Promise<void> {
    await this.mustFindStage(organizationId, pipelineId, stageId);
    const deals = await this.dealRepo.count({ where: { organizationId, stageId }, withDeleted: true });
    if (deals > 0) throw new BadRequestException('The stage has deals — deletion is not allowed');
    await this.stageRepo.delete({ id: stageId });
  }

  /** Default pipeline + first stage — for lead conversion. */
  async defaultTarget(organizationId: string): Promise<{ pipelineId: string; stageId: string }> {
    const pipeline =
      (await this.pipelineRepo.findOne({ where: { organizationId, isDefault: true } })) ??
      (await this.pipelineRepo.findOne({ where: { organizationId }, order: { position: 'ASC' } }));
    if (!pipeline) throw new BadRequestException('The organization has no pipelines');
    const stage = await this.stageRepo.findOne({
      where: { organizationId, pipelineId: pipeline.id },
      order: { position: 'ASC' },
    });
    if (!stage) throw new BadRequestException('The pipeline has no stages');
    return { pipelineId: pipeline.id, stageId: stage.id };
  }

  private async mustFindPipeline(organizationId: string, id: string): Promise<PipelineEntity> {
    const pipeline = await this.pipelineRepo.findOne({ where: { id, organizationId } });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  private async mustFindStage(organizationId: string, pipelineId: string, stageId: string): Promise<PipelineStageEntity> {
    const stage = await this.stageRepo.findOne({ where: { id: stageId, pipelineId, organizationId } });
    if (!stage) throw new NotFoundException('Stage not found');
    return stage;
  }

  private toPipelineDto(p: PipelineEntity, stages: PipelineStageEntity[]): PipelineDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      isDefault: p.isDefault,
      position: p.position,
      stages: stages.map((s) => this.toStageDto(s)),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private toStageDto(s: PipelineStageEntity): PipelineStageDto {
    return {
      id: s.id,
      organizationId: s.organizationId,
      pipelineId: s.pipelineId,
      name: s.name,
      position: s.position,
      probability: s.probability,
      isWon: s.isWon,
      isLost: s.isLost,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
