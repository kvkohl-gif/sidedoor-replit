import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Globe, Building2 } from "lucide-react";

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  primary_domain?: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  employees?: number;
}

interface CompanySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizations: ApolloOrganization[];
  onConfirm: (organizationId: string | null, customDomain?: string) => void;
  isLoading?: boolean;
}

export function CompanySelectionModal({
  isOpen,
  onClose,
  organizations,
  onConfirm,
  isLoading = false
}: CompanySelectionModalProps) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDomain, setCustomDomain] = useState("");

  const handleConfirm = () => {
    if (showCustomInput) {
      onConfirm(null, customDomain);
    } else if (selectedOrganizationId) {
      onConfirm(selectedOrganizationId);
    }
  };

  const handleNoneMatch = () => {
    setShowCustomInput(true);
    setSelectedOrganizationId("");
  };

  const isConfirmDisabled = !selectedOrganizationId && (!showCustomInput || !customDomain.trim());

  if (organizations.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Confirm Company Match
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We found {organizations.length} potential company match{organizations.length !== 1 ? 'es' : ''} in Apollo.
            Please select the correct company to ensure accurate contact search.
          </p>

          {!showCustomInput ? (
            <>
              <RadioGroup
                value={selectedOrganizationId}
                onValueChange={setSelectedOrganizationId}
                className="space-y-3"
              >
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value={org.id} id={org.id} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={org.id} className="cursor-pointer">
                        <div className="flex items-center gap-3">
                          {org.logo_url ? (
                            <img 
                              src={org.logo_url} 
                              alt={`${org.name} logo`}
                              className="w-8 h-8 rounded object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-sm">{org.name}</div>
                            {(org.website_url || org.primary_domain) && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Globe className="w-3 h-3" />
                                {org.primary_domain || org.website_url}
                              </div>
                            )}
                            {org.industry && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {org.industry}
                                {org.employees && ` • ${org.employees.toLocaleString()} employees`}
                              </div>
                            )}
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNoneMatch}
                  className="text-sm"
                >
                  None of these match - Enter domain manually
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3 p-4 border rounded-lg bg-accent/50">
              <div className="text-sm font-medium">Manual Domain Entry</div>
              <div className="text-xs text-muted-foreground">
                Enter the company's website domain (e.g., company.com)
              </div>
              <Input
                placeholder="company.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="max-w-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomDomain("");
                }}
              >
                ← Back to organization list
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isConfirmDisabled || isLoading}
          >
            {isLoading ? "Searching contacts..." : "Confirm & Search Contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}