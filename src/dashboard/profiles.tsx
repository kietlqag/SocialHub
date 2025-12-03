import type { ReactNode } from "react";
import {
  ShoppingCart,
  Users,
  Package,
  Activity,
  Stethoscope,
  HeartPulse,
  GraduationCap,
  BookOpenText,
  BriefcaseBusiness,
  Wallet,
  Target,
  UserRoundCheck,
  FileCheck2,
} from "lucide-react";

export interface MetricConfig {
  key: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  sourceTable?: string;
}

export interface DashboardProfile {
  type: string;
  metrics: MetricConfig[];
}

export const dashboardProfiles: DashboardProfile[] = [
  {
    type: "store",
    metrics: [
      { key: "newOrders", label: "New Orders Today", icon: <ShoppingCart className="w-4 h-4" />, sourceTable: "orders" },
      { key: "revenueToday", label: "Revenue Today", icon: <Activity className="w-4 h-4" />, sourceTable: "orders" },
      { key: "newCustomers", label: "New Customers", icon: <Users className="w-4 h-4" />, sourceTable: "customers" },
      { key: "lowStock", label: "Low Stock Items", icon: <Package className="w-4 h-4" />, sourceTable: "products" },
      { key: "pendingShipments", label: "Pending Shipments", icon: <Package className="w-4 h-4" />, sourceTable: "orders" },
      { key: "returns", label: "Returns", icon: <ShoppingCart className="w-4 h-4" />, sourceTable: "returns" },
    ],
  },
  {
    type: "hospital",
    metrics: [
      { key: "newPatients", label: "New Patients Today", icon: <Stethoscope className="w-4 h-4" />, sourceTable: "patients" },
      { key: "admitted", label: "Patients Admitted", icon: <HeartPulse className="w-4 h-4" />, sourceTable: "patients" },
      { key: "discharged", label: "Discharged Today", icon: <HeartPulse className="w-4 h-4" />, sourceTable: "patients" },
      { key: "emergency", label: "Emergency Cases", icon: <HeartPulse className="w-4 h-4" />, sourceTable: "emergency" },
      { key: "icuOccupancy", label: "ICU Occupancy", icon: <HeartPulse className="w-4 h-4" />, sourceTable: "icu" },
      { key: "avgWaitTime", label: "Avg. Wait Time (min)", icon: <Stethoscope className="w-4 h-4" />, sourceTable: "patients" },
      { key: "scheduledSurgeries", label: "Scheduled Surgeries", icon: <HeartPulse className="w-4 h-4" />, sourceTable: "surgeries" },
      { key: "staffOnDuty", label: "Staff On Duty", icon: <Users className="w-4 h-4" />, sourceTable: "staff" },
    ],
  },
  {
    type: "school",
    metrics: [
      { key: "newEnrollments", label: "New Enrollments", icon: <GraduationCap className="w-4 h-4" />, sourceTable: "students" },
      { key: "activeCourses", label: "Active Courses", icon: <BookOpenText className="w-4 h-4" />, sourceTable: "courses" },
      { key: "assignmentsDue", label: "Assignments Due", icon: <BookOpenText className="w-4 h-4" />, sourceTable: "assignments" },
      { key: "attendanceRate", label: "Attendance Rate", icon: <Users className="w-4 h-4" />, sourceTable: "attendance" },
    ],
  },
  {
    type: "hr",
    metrics: [
      { key: "totalEmployees", label: "Total Employees", icon: <Users className="w-4 h-4" />, sourceTable: "employees" },
      { key: "newHires", label: "New Hires", icon: <UserRoundCheck className="w-4 h-4" />, sourceTable: "employees" },
      { key: "resignations", label: "Resignations", icon: <BriefcaseBusiness className="w-4 h-4" />, sourceTable: "employees" },
      { key: "attendanceRate", label: "Attendance Rate", icon: <Activity className="w-4 h-4" />, sourceTable: "attendance" },
    ],
  },
  {
    type: "crm",
    metrics: [
      { key: "newDeals", label: "New Deals", icon: <Target className="w-4 h-4" />, sourceTable: "deals" },
      { key: "pipelineValue", label: "Pipeline Value", icon: <Wallet className="w-4 h-4" />, sourceTable: "deals" },
      { key: "meetingsScheduled", label: "Meetings Scheduled", icon: <FileCheck2 className="w-4 h-4" />, sourceTable: "meetings" },
      { key: "wonDeals", label: "Won Deals", icon: <Target className="w-4 h-4" />, sourceTable: "deals" },
    ],
  },
];
