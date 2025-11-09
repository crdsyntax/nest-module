#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Debes proporcionar el nombre del módulo. Ej: node scripts/generate-module.js nombreModulo');
  process.exit(1);
}

const rawName = args[0];

const kebabName = rawName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
const camelName = kebabName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const className = camelName.charAt(0).toUpperCase() + camelName.slice(1);
const moduleDir = `src/${kebabName}`;

console.log(`🛠️ Generando módulo ${kebabName}...`);
execSync(`npx --yes @nestjs/cli g module ${kebabName}`, { stdio: 'inherit' });

const folders = ['services', 'controllers', 'dto', 'entities', 'tests', 'repositories'];
folders.forEach(folder => {
  const fullPath = path.join(moduleDir, folder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Carpeta creada: ${fullPath}`);
  }
});

const entityFile = path.join(moduleDir, 'entities', `${kebabName}.entity.ts`);
if (!fs.existsSync(entityFile)) {
  fs.writeFileSync(entityFile,
`import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, UpdateDatecolumn, CreateDateColumn } from 'typeorm';

@Entity()
export class ${className} {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDatecolumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
`);
  console.log(`📄 Entity creada: ${entityFile}`);
}

const dtoFile = path.join(moduleDir, 'dto', `create-${kebabName}.dto.ts`);
if (!fs.existsSync(dtoFile)) {
  fs.writeFileSync(dtoFile,
`import { ApiProperty } from '@nestjs/swagger';

export class Create${className}Dto {
  @ApiProperty()
  name: string;
}
`);
  console.log(`📄 DTO creado: ${dtoFile}`);
}

const updateDtoFile = path.join(moduleDir, 'dto', `update-${kebabName}.dto.ts`);
if (!fs.existsSync(updateDtoFile)) {
  fs.writeFileSync(updateDtoFile,
`import { PartialType } from '@nestjs/mapped-types';
import { Create${className}Dto } from './create-${kebabName}.dto';

export class Update${className}Dto extends PartialType(Create${className}Dto) {}
`);
  console.log(`📄 Update DTO creado: ${updateDtoFile}`);
}

execSync(`npx --yes @nestjs/cli g service ${kebabName}`, { stdio: 'inherit' });
fs.renameSync(`${moduleDir}/${kebabName}.service.ts`, `${moduleDir}/services/${kebabName}.service.ts`);
fs.renameSync(`${moduleDir}/${kebabName}.service.spec.ts`, `${moduleDir}/tests/${kebabName}.service.spec.ts`);

const servicePath = path.join(moduleDir, 'services', `${kebabName}.service.ts`);
fs.writeFileSync(servicePath,
`import { Injectable } from '@nestjs/common';
import { ${className}Repository } from '../repositories/${kebabName}.repository';
import { Create${className}Dto } from '../dto/create-${kebabName}.dto';
import { Update${className}Dto } from '../dto/update-${kebabName}.dto';

@Injectable()
export class ${className}Service {
  constructor(private readonly repository: ${className}Repository) {}

 async findAll(page = 1, limit = 10) {
    try {
      if (page < 1 || limit < 1) {
        throw new HttpException("Parámetros inválidos", HttpStatus.BAD_REQUEST);
      }
      return await this.repository.findAll(page, limit);
    } catch (error) {
      this.logger.error(error.message);
      throw new HttpException("Error al obtener registros", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: number) {
    try {
      const item = await this.repository.findOne(id);
      if (!item) throw new HttpException("${className} no encontrado", HttpStatus.NOT_FOUND);
      return item;
    } catch (error) {
      this.logger.error(error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException("Error al obtener el registro", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(data: any) {
    try {
      return await this.repository.create(data);
    } catch (error) {
      this.logger.error(error.message);
      throw new HttpException("Error al crear el registro", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(id: number, data: any) {
    try {
      const updated = await this.repository.update(id, data);
      if (!updated) throw new HttpException("${className} no encontrado", HttpStatus.NOT_FOUND);
      return updated;
    } catch (error) {
      this.logger.error(error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException("Error al actualizar", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async remove(id: number) {
    try {
      const deleted = await this.repository.remove(id);
      if (!deleted) throw new HttpException("${className} no encontrado", HttpStatus.NOT_FOUND);
      return deleted;
    } catch (error) {
      this.logger.error(error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException("Error al eliminar", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
`);
console.log(`🧩 Service generado (solo delega al repositorio): ${servicePath}`);

const repositoryPath = path.join(moduleDir, 'repositories', `${kebabName}.repository.ts`);
if (!fs.existsSync(repositoryPath)) {
  fs.writeFileSync(repositoryPath,
`import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${className} } from '../entities/${kebabName}.entity';
import { Create${className}Dto } from '../dto/create-${kebabName}.dto';
import { Update${className}Dto } from '../dto/update-${kebabName}.dto';

@Injectable()
export class ${className}Repository {
  constructor(
    @InjectRepository(${className})
    private readonly repo: Repository<${className}>,
  ) {}

  create(createDto: Create${className}Dto) {
    const entity = this.repo.create(createDto);
    return this.repo.save(entity);
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.repo.findAndCount({ skip, take: limit });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  update(id: number, updateDto: Update${className}Dto) {
    return this.repo.update(id, updateDto);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
`);
  console.log(`📦 Repository con CRUD básico generado: ${repositoryPath}`);
}

execSync(`npx --yes @nestjs/cli g controller ${kebabName}`, { stdio: 'inherit' });
fs.renameSync(`${moduleDir}/${kebabName}.controller.ts`, `${moduleDir}/controllers/${kebabName}.controller.ts`);
fs.renameSync(`${moduleDir}/${kebabName}.controller.spec.ts`, `${moduleDir}/tests/${kebabName}.controller.spec.ts`);

const controllerPath = path.join(moduleDir, 'controllers', `${kebabName}.controller.ts`);
fs.writeFileSync(controllerPath,
`import { Controller, Get, Post, Body, Param, Patch, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ${className}Service } from '../services/${kebabName}.service';
import { Create${className}Dto } from '../dto/create-${kebabName}.dto';
import { Update${className}Dto } from '../dto/update-${kebabName}.dto';
import { ${className} } from '../entities/${kebabName}.entity';

@ApiTags('${className}')
@Controller('${kebabName}')
export class ${className}Controller {
  constructor(private readonly service: ${className}Service) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo ${className}' })
  @ApiResponse({ status: 201, description: 'Entidad creada', type: ${className} })
  create(@Body() createDto: Create${className}Dto) {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las entidades ${className}' })
  @ApiResponse({ status: 200, description: 'Listado de entidades', type: [${className}] })
  @ApiQuery({ name: 'page', type: Number, description: 'Numero de paginacion.'})
  @ApiQuery({ name: 'limit', type: Number, description: 'Limite de paginacion.'})
  findAll(@Query("page", ParseIntPipe) page = 1, @Query("limit", ParseIntPipe) limit = 10) {
    return this.service.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener ${className} por id' })
  @ApiResponse({ status: 200, description: 'Entidad encontrada', type: ${className} })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar ${className} por id' })
  @ApiResponse({ status: 200, description: 'Entidad actualizada', type: ${className} })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: Update${className}Dto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar ${className} por id' })
  @ApiResponse({ status: 200, description: 'Entidad eliminada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
`);
console.log(`📝 Controller con CRUD y Swagger generado: ${controllerPath}`);

console.log(`✅ Módulo ${className} generado exitosamente con servicio delegado y repositorio CRUD.`);
