import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { User } from "../../iam/domain/entities/user.entity";
import { Roles } from "../../iam/infrastructure/decorators/roles.decorator";
import { CurrentUser } from "../../iam/infrastructure/decorators/user.decorator";
import { JwtAuthGuard } from "../../iam/infrastructure/guards/jwt-auth.guard";
import { RolesGuard } from "../../iam/infrastructure/guards/roles.guard";
import { ZodBody } from "../../shared/decorators/zod-body.decorator";
import { ZodMultipart } from "../../shared/decorators/zod-multipart.decorator";
import { CarUploadInterceptor } from "../../shared/interceptors/file-upload.interceptor";
import { LoggerService } from "../../shared/logging/logger.service";
import { CarUploadApplicationService } from "../application/services/car-upload-application.service";
import { FleetApplicationService } from "../application/services/fleet-application.service";
import { CarNotFoundError } from "../domain/errors/fleet.errors";
import { AssignChauffeurDto, assignChauffeurSchema } from "./dto/assign-chauffeur.dto";
import { RejectCarDto, rejectCarSchema } from "./dto/car-approval.dto";
import { CarUploadCompleteDto, carUploadCompleteSchema } from "./dto/car-upload-complete.dto";
import { CreateFleetDto, createFleetSchema } from "./dto/create-fleet.dto";
import { UpdateCarDto, updateCarSchema } from "./dto/update-car.dto";

@Controller("fleet")
export class FleetController {
  constructor(
    private readonly fleetService: FleetApplicationService,
    private readonly carUploadService: CarUploadApplicationService,
    private readonly logger: LoggerService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  async createFleet(
    @ZodBody(createFleetSchema) dto: CreateFleetDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Creating fleet", { ownerId: currentUser.getId() });

    return this.fleetService.createFleet({
      ownerId: currentUser.getId(),
      name: dto.name,
    });
  }

  @Get("my-fleet")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  async getMyFleet(@CurrentUser() currentUser: User) {
    const userId = currentUser.getId();
    this.logger.info("Getting fleet for owner", { ownerId: userId });

    return this.fleetService.getFleetByOwnerId(userId);
  }

  @Post("cars")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  @UseInterceptors(CarUploadInterceptor)
  async createCar(
    @ZodMultipart(carUploadCompleteSchema) validatedData: CarUploadCompleteDto,
    @CurrentUser() currentUser: User,
  ) {
    const ownerId = currentUser.getId();
    this.logger.info("Creating car with documents", {
      ownerId,
      make: validatedData.make,
      model: validatedData.model,
    });

    return this.carUploadService.uploadCar(ownerId, validatedData);
  }

  @Get("cars")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  async getMyCars(@CurrentUser() currentUser: User) {
    const ownerId = currentUser.getId();
    this.logger.info("Getting cars for owner", { ownerId });

    return this.fleetService.getFleetCars(ownerId);
  }

  @Get("cars/:carId")
  @UseGuards(JwtAuthGuard)
  async getCar(@Param("carId") carId: string) {
    this.logger.info("Getting car details", { carId });

    const car = await this.fleetService.getCarById(carId);
    if (!car) {
      throw new CarNotFoundError(carId);
    }

    return car;
  }

  @Put("cars/:carId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  async updateCar(
    @Param("carId") carId: string,
    @ZodBody(updateCarSchema) dto: UpdateCarDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Updating car", { carId, updates: dto });

    // Application service handles validation and business logic
    return this.fleetService.updateCar(carId, currentUser.getId(), dto);
  }

  @Delete("cars/:carId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  async deleteCar(@Param("carId") carId: string, @CurrentUser() currentUser: User) {
    this.logger.info("Deleting car", { carId });

    // Application service handles validation and business logic
    await this.fleetService.deleteCar(carId, currentUser.getId());
    return { success: true, message: "Car deleted successfully" };
  }

  @Post("chauffeurs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("fleetOwner")
  async assignChauffeur(
    @ZodBody(assignChauffeurSchema) dto: AssignChauffeurDto,
    @CurrentUser() currentUser: User,
  ) {
    const ownerId = currentUser.getId();
    this.logger.info("Assigning chauffeur to fleet", { ownerId, chauffeurId: dto.chauffeurId });

    await this.fleetService.assignChauffeurToFleet(ownerId, dto.chauffeurId);
    return { success: true, message: "Chauffeur assigned successfully" };
  }

  // Car approval endpoints (Admin/Staff only)
  @Get("cars/pending-approval")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "staff")
  async getPendingApprovalCars() {
    this.logger.info("Getting pending approval cars");

    return this.fleetService.getPendingApprovalCars();
  }

  @Put("cars/:carId/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "staff")
  async approveCar(@Param("carId") carId: string, @CurrentUser() currentUser: User) {
    this.logger.info("Approving car", { carId, approvedBy: currentUser.getId() });

    return this.fleetService.approveCar(carId, currentUser.getId());
  }

  @Put("cars/:carId/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "staff")
  async rejectCar(
    @Param("carId") carId: string,
    @ZodBody(rejectCarSchema) dto: RejectCarDto,
    @CurrentUser() currentUser: User,
  ) {
    this.logger.info("Rejecting car", { carId, rejectedBy: currentUser.getId() });

    return this.fleetService.rejectCar(carId, currentUser.getId(), dto.reason);
  }
}
