import { envVars } from "../../config/env";

export interface ICourierStat {
  name: string;
  logo: string;
  total_parcel: number;
  success_parcel: number;
  cancelled_parcel: number;
  success_ratio: number;
}

export interface ICourierCheckReport {
  id: string;
  name: string;
  details: string;
  created_at: string;
  courierLogo: string;
  courierName: string;
}

export interface ICourierCheckResponse {
  status: string;
  data: Record<string, ICourierStat>;
  reports: ICourierCheckReport[];
}

export class BDCourierService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = envVars.BDCOURIER.API_KEY || "";
    this.apiUrl = envVars.BDCOURIER.API_BASE_URL || "https://api.bdcourier.com";

    if (!this.apiKey) {
      throw new Error("BDCourier API key is missing...");
    }
  }

  async checkPhone(phone: string): Promise<ICourierCheckResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/courier-check`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(
          `BDCourier API error: ${response.status} - ${data.message || "unknown error"}`,
        );
      }

      return data as ICourierCheckResponse;
    } catch (error) {
      console.error("Error checking phone with BDCourier:", error);
      throw error;
    }
  }
}
