-- Atualização da tabela Prescription
-- Adiciona novos campos e renomeia os existentes para separar grau de longe e perto.

ALTER TABLE `Prescription`
  -- Renomear campos antigos (grau de longe)
  RENAME COLUMN `odSpherical`        TO `odSphericalFar`,
  RENAME COLUMN `odCylindrical`      TO `odCylindricalFar`,
  RENAME COLUMN `odAxis`             TO `odAxisFar`,
  RENAME COLUMN `odDnp`              TO `odDnpFar`,
  RENAME COLUMN `oeSpherical`        TO `oeSphericalFar`,
  RENAME COLUMN `oeCylindrical`      TO `oeCylindricalFar`,
  RENAME COLUMN `oeAxis`             TO `oeAxisFar`,
  RENAME COLUMN `oeDnp`              TO `oeDnpFar`;

-- Agora adicionamos os novos campos
ALTER TABLE `Prescription`
  ADD COLUMN `odSphericalNear`     VARCHAR(191) NULL AFTER `odDnpFar`,
  ADD COLUMN `odCylindricalNear`   VARCHAR(191) NULL AFTER `odSphericalNear`,
  ADD COLUMN `odAxisNear`          VARCHAR(191) NULL AFTER `odCylindricalNear`,
  ADD COLUMN `odDnpNear`           VARCHAR(191) NULL AFTER `odAxisNear`,
  ADD COLUMN `oeSphericalNear`     VARCHAR(191) NULL AFTER `oeDnpFar`,
  ADD COLUMN `oeCylindricalNear`   VARCHAR(191) NULL AFTER `oeSphericalNear`,
  ADD COLUMN `oeAxisNear`          VARCHAR(191) NULL AFTER `oeCylindricalNear`,
  ADD COLUMN `oeDnpNear`           VARCHAR(191) NULL AFTER `oeAxisNear`,

  -- Campos de película (bifocal/progressiva)
  ADD COLUMN `odPellicleFar`       VARCHAR(191) NULL AFTER `oeDnpNear`,
  ADD COLUMN `odPellicleNear`      VARCHAR(191) NULL AFTER `odPellicleFar`,
  ADD COLUMN `oePellicleFar`       VARCHAR(191) NULL AFTER `odPellicleNear`,
  ADD COLUMN `oePellicleNear`      VARCHAR(191) NULL AFTER `oePellicleFar`,

  -- Campos gerais
  ADD COLUMN `frameAndRef`         VARCHAR(191) NULL AFTER `oePellicleNear`,
  ADD COLUMN `lensType`            VARCHAR(191) NULL AFTER `frameAndRef`,
  ADD COLUMN `notes`               VARCHAR(191) NULL AFTER `lensType`;
