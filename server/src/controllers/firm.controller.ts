import type { Request, Response } from "express";
import { firmService } from "../services/firm.service.js";

export async function createFirmController(
  req: Request,
  res: Response
) {
  try {
    if (!req.tenantContext) {
      return res.status(401).json({
        success: false,
        message: "Contexto de acesso não encontrado.",
      });
    }

    const tenantContext = req.tenantContext;

    const firm = await firmService.create(
      tenantContext,
      req.body
    );

    return res.status(201).json({
      success: true,
      data: firm,
    });
  } catch (error) {
    console.error("Erro ao criar escritório:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível criar o escritório.",
    });
  }
}

export async function listFirmsController(
  req: Request,
  res: Response
) {
  try {
    if (!req.tenantContext) {
      return res.status(401).json({
        success: false,
        message: "Contexto de acesso não encontrado.",
      });
    }

    const tenantContext = req.tenantContext;

    const firms = await firmService.list(
      tenantContext
    );

    return res.json({
      success: true,
      data: firms,
    });
  } catch (error) {
    console.error("Erro ao listar escritórios:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível listar os escritórios.",
    });
  }
}

export async function getFirmController(
  req: Request,
  res: Response
) {
  try {
    if (!req.tenantContext) {
      return res.status(401).json({
        success: false,
        message: "Contexto de acesso não encontrado.",
      });
    }

    const tenantContext = req.tenantContext;

    const firm = await firmService.getById(
      tenantContext,
      req.params.firmId
    );

    return res.json({
      success: true,
      data: firm,
    });
  } catch (error) {
    console.error("Erro ao buscar escritório:", error);

    return res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Escritório não encontrado.",
    });
  }
}

export async function updateFirmController(
  req: Request,
  res: Response
) {
  try {
    if (!req.tenantContext) {
      return res.status(401).json({
        success: false,
        message: "Contexto de acesso não encontrado.",
      });
    }

    const tenantContext = req.tenantContext;

    const firm = await firmService.update(
      tenantContext,
      req.params.firmId,
      req.body
    );

    return res.json({
      success: true,
      data: firm,
    });
  } catch (error) {
    console.error("Erro ao atualizar escritório:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o escritório.",
    });
  }
}

export async function deleteFirmController(
  req: Request,
  res: Response
) {
  try {
    if (!req.tenantContext) {
      return res.status(401).json({
        success: false,
        message: "Contexto de acesso não encontrado.",
      });
    }

    const tenantContext = req.tenantContext;

    const result = await firmService.delete(
      tenantContext,
      req.params.firmId
    );

    return res.json(result);
  } catch (error) {
    console.error("Erro ao excluir escritório:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o escritório.",
    });
  }
}