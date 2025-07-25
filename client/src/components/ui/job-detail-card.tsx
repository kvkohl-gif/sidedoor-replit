import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Building, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JobDetailData {
  job_title: string;
  company_name: string;
  job_url: string;
  company_website: string;
  location: string;
  job_description: string;
  key_responsibilities: string[];
  requirements: string[];
  likely_departments: string[];
}

interface JobDetailCardProps {
  jobData: JobDetailData;
  className?: string;
}

export function JobDetailCard({ jobData, className }: JobDetailCardProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: `${label} copied successfully`,
      });
    });
  };

  const openUrl = (url: string) => {
    if (url && url !== "Not specified") {
      window.open(url, '_blank');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building className="h-5 w-5" />
          Job Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Job Title */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Job Title:
          </h3>
          <p className="text-base mt-1">{jobData.job_title}</p>
        </div>

        {/* Company */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Company:
          </h3>
          <p className="text-base mt-1">{jobData.company_name}</p>
        </div>

        {/* Job URL */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Job URL:
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-base flex-1 break-all">
              {jobData.job_url === "Not specified" ? (
                <span className="text-gray-500">Not specified</span>
              ) : (
                jobData.job_url
              )}
            </p>
            {jobData.job_url !== "Not specified" && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(jobData.job_url, "Job URL")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openUrl(jobData.job_url)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Company Website */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Company Website:
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-base flex-1 break-all">
              {jobData.company_website === "Not specified" ? (
                <span className="text-gray-500">Not specified</span>
              ) : (
                jobData.company_website
              )}
            </p>
            {jobData.company_website !== "Not specified" && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(jobData.company_website, "Company Website")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openUrl(jobData.company_website)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location:
          </h3>
          <p className="text-base mt-1">{jobData.location}</p>
        </div>

        {/* Job Description */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Job Description:
          </h3>
          <p className="text-base mt-2 leading-relaxed">{jobData.job_description}</p>
        </div>

        {/* Key Responsibilities */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Key Responsibilities:
          </h3>
          <ul className="list-disc list-inside space-y-1 mt-2">
            {jobData.key_responsibilities.map((responsibility, index) => (
              <li key={index} className="text-base leading-relaxed">
                {responsibility}
              </li>
            ))}
          </ul>
        </div>

        {/* Requirements */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Requirements:
          </h3>
          <ul className="list-disc list-inside space-y-1 mt-2">
            {jobData.requirements.map((requirement, index) => (
              <li key={index} className="text-base leading-relaxed">
                {requirement}
              </li>
            ))}
          </ul>
        </div>

        {/* Likely Departments */}
        <div>
          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">
            Likely Departments:
          </h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {jobData.likely_departments.map((department, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                {department}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}