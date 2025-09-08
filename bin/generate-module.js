#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('❌ Debes proporcionar el nombre del módulo. Ej: node scripts/generate-module.js nombreModulo');
    process.exit(1);
}

const moduleName = args[0];
const kebabName = moduleName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
const className = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
const moduleDir = `src/${kebabName}`;

console.log(`🛠️ Generando módulo ${kebabName}...`);
execSync(`npx nest g module ${kebabName}`, { stdio: 'inherit' });

const folders = ['services', 'controllers', 'dto', 'entities', 'tests'];
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
        `import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class ${className} {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
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

execSync(`npx nest g service ${kebabName}`, { stdio: 'inherit' });
fs.renameSync(`${moduleDir}/${kebabName}.service.ts`, `${moduleDir}/services/${kebabName}.service.ts`);
fs.renameSync(`${moduleDir}/${kebabName}.service.spec.ts`, `${moduleDir}/tests/${kebabName}.service.spec.ts`);

const servicePath = path.join(moduleDir, 'services', `${kebabName}.service.ts`);
fs.writeFileSync(servicePath,
    `import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ${className} } from '../entities/${kebabName}.entity';
import { Create${className}Dto } from '../dto/create-${kebabName}.dto';
import { Update${className}Dto } from '../dto/update-${kebabName}.dto';

@Injectable()
export class ${className}Service {
  constructor(
    @InjectRepository(${className})
    private readonly repo: Repository<${className}>,
  ) {}

  create(createDto: Create${className}Dto) {
    const entity = this.repo.create(createDto);
    return this.repo.save(entity);
  }

  findAll() {
    return this.repo.find();
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
console.log(`📝 Service con CRUD básico generado: ${servicePath}`);

execSync(`npx nest g controller ${kebabName}`, { stdio: 'inherit' });
fs.renameSync(`${moduleDir}/${kebabName}.controller.ts`, `${moduleDir}/controllers/${kebabName}.controller.ts`);
fs.renameSync(`${moduleDir}/${kebabName}.controller.spec.ts`, `${moduleDir}/tests/${kebabName}.controller.spec.ts`);

const controllerPath = path.join(moduleDir, 'controllers', `${kebabName}.controller.ts`);
fs.writeFileSync(controllerPath,
    `import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
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
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener ${className} por id' })
  @ApiResponse({ status: 200, description: 'Entidad encontrada', type: ${className} })
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar ${className} por id' })
  @ApiResponse({ status: 200, description: 'Entidad actualizada', type: ${className} })
  update(@Param('id') id: number, @Body() updateDto: Update${className}Dto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar ${className} por id' })
  @ApiResponse({ status: 200, description: 'Entidad eliminada' })
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
`);
console.log(`📝 Controller con CRUD y Swagger generado: ${controllerPath}`);

console.log(`✅ Módulo ${className} generado exitosamente con CRUD básico y endpoints.`);
