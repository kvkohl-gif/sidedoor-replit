import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

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
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
      <Card>
        <CardContent className="p-6">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
            <h2 className="text-lg font-semibold text-slate-900">Job Information</h2>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            )}
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4 space-y-4">
            {/* Job URL - Display first */}
            <div>
              <h3 className="font-medium text-slate-900 mb-2">Job URL</h3>
              <a 
                href={jobData.job_url !== "Not specified" ? jobData.job_url : "#"} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-blue-700 break-all text-sm flex items-center"
              >
                {jobData.job_url}
                {jobData.job_url !== "Not specified" && <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />}
              </a>
            </div>

            {/* Company Website */}
            <div>
              <h3 className="font-medium text-slate-900 mb-2">Company Website</h3>
              {jobData.company_website && jobData.company_website !== "Not specified" ? (
                <a 
                  href={jobData.company_website.startsWith('http') ? jobData.company_website : `https://${jobData.company_website}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-blue-700 break-all text-sm flex items-center"
                >
                  {jobData.company_website}
                  <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-slate-500 text-sm">Not specified</span>
              )}
            </div>

            {/* Company Website - Display second */}
            {jobData.company_website && jobData.company_website !== "Not specified" && (
              <div>
                <h3 className="font-medium text-slate-900 mb-2">Company Website</h3>
                <a 
                  href={jobData.company_website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-blue-700 break-all text-sm flex items-center"
                >
                  {jobData.company_website}
                  <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />
                </a>
              </div>
            )}

            {/* Job Description Summary - Display third */}
            <div>
              <h3 className="font-medium text-slate-900 mb-2">Job Description</h3>
              <p className="text-slate-700 text-sm leading-relaxed">
                {jobData.job_description}
              </p>
            </div>

            {/* Enhanced Job Details - Side by side layout */}
            {((jobData.key_responsibilities && jobData.key_responsibilities.length > 0 && jobData.key_responsibilities[0] !== "Not specified") ||
              (jobData.requirements && jobData.requirements.length > 0 && jobData.requirements[0] !== "Not specified")) && (
              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                {jobData.key_responsibilities && jobData.key_responsibilities.length > 0 && jobData.key_responsibilities[0] !== "Not specified" && (
                  <div>
                    <h3 className="font-medium text-slate-900 mb-2">Key Responsibilities</h3>
                    <ul className="text-sm text-slate-700 space-y-1">
                      {jobData.key_responsibilities.map((item: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {jobData.requirements && jobData.requirements.length > 0 && jobData.requirements[0] !== "Not specified" && (
                  <div>
                    <h3 className="font-medium text-slate-900 mb-2">Requirements</h3>
                    <ul className="text-sm text-slate-700 space-y-1">
                      {jobData.requirements.map((item: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Likely Departments */}
            {jobData.likely_departments && jobData.likely_departments.length > 0 && jobData.likely_departments[0] !== "Other" && (
              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-medium text-slate-900 mb-2">Likely Departments</h3>
                <div className="flex flex-wrap gap-2">
                  {jobData.likely_departments.map((dept: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {dept}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}