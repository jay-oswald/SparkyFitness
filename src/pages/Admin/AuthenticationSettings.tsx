import React, { useState, useEffect } from 'react';
import { oidcSettingsService, type OidcSettings } from '../../services/oidcSettingsService';
import { toast } from '@/hooks/use-toast';
import { ClipboardCopy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const AuthenticationSettings: React.FC = () => {
  const [settings, setSettings] = useState<OidcSettings & { enable_email_password_login?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayClientSecret, setDisplayClientSecret] = useState<string>('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const fetchedSettings = await oidcSettingsService.getSettings();
        // Initialize with empty values if no settings are found, to allow configuration
        const settingsForState = {
          issuer_url: fetchedSettings?.issuer_url || '',
          client_id: fetchedSettings?.client_id || '',
          client_secret: undefined,
          redirect_uris: fetchedSettings?.redirect_uris || [],
          scope: fetchedSettings?.scope || 'openid profile email',
          token_endpoint_auth_method: fetchedSettings?.token_endpoint_auth_method || 'client_secret_post',
          response_types: fetchedSettings?.response_types || ['code'],
          is_active: fetchedSettings?.is_active || false,
          id_token_signed_response_alg: fetchedSettings?.id_token_signed_response_alg || 'RS256',
          userinfo_signed_response_alg: fetchedSettings?.userinfo_signed_response_alg || 'none',
          request_timeout: fetchedSettings?.request_timeout || 30000,
          auto_register: fetchedSettings?.auto_register || false,
          enable_email_password_login: fetchedSettings?.enable_email_password_login ?? true,
        };

        if (fetchedSettings && fetchedSettings.client_secret) {
          setDisplayClientSecret('*****'); // Show placeholder if secret exists
        } else {
          setDisplayClientSecret('');
        }
        setSettings(settingsForState); // Set the constructed object
      } catch (err: any) {
        setError(err.message || 'Failed to fetch OIDC settings.');
        toast({
          title: "Error",
          description: "Failed to load OIDC settings.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    if (id === 'client_secret') {
      setDisplayClientSecret(value); // Update display value as user types
      // If the user types, send the new value. If they leave it as '*****', send undefined.
      setSettings(prev => ({ ...prev!, [id]: value === '*****' ? undefined : value }));
    } else if (id === 'redirect_uris') {
      setSettings(prev => ({ ...prev!, [id]: value.split(',').map(uri => uri.trim()) }));
    } else if (id === 'request_timeout') {
      setSettings(prev => ({ ...prev!, [id]: parseInt(value, 10) }));
    } else {
      setSettings(prev => ({ ...prev!, [id]: value }));
    }
  };

  const handleSwitchChange = (id: string, checked: boolean) => {
    setSettings(prev => {
      const newSettings = { ...prev!, [id]: checked };
      // Automatically save when a switch is toggled
      oidcSettingsService.saveSettings(newSettings).then(() => {
        toast({
          title: "Settings Saved",
          description: "Your authentication settings have been updated.",
        });
      }).catch(err => {
        toast({
          title: "Error",
          description: "Failed to save settings.",
          variant: "destructive",
        });
      });
      return newSettings;
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setLoading(true);
    try {
      await oidcSettingsService.saveSettings(settings);
      toast({
        title: "Success",
        description: "OIDC settings saved successfully.",
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save OIDC settings.');
      toast({
        title: "Error",
        description: "Failed to save OIDC settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading OIDC settings...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!settings) {
    return <div>No OIDC settings found. Please configure.</div>;
  }

  return (
    <Card className="w-full mx-auto">
      <CardHeader>
        <CardTitle>Authentication Settings</CardTitle>
        <CardDescription>Manage password, OAuth, and other authentication settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Login Management</CardTitle>
              <CardDescription>Enable or disable different methods for users to log in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-md">
                <Label htmlFor="enable_email_password_login" className="font-medium">
                  Enable Email & Password Login
                </Label>
                <Switch
                  id="enable_email_password_login"
                  checked={settings.enable_email_password_login}
                  onCheckedChange={(checked) => handleSwitchChange('enable_email_password_login', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-md">
                <Label htmlFor="is_active" className="font-medium">
                  Enable OIDC Login
                </Label>
                <Switch
                  id="is_active"
                  checked={settings.is_active}
                  onCheckedChange={(checked) => handleSwitchChange('is_active', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="oidc-provider-settings">
              <AccordionTrigger>OIDC Provider Settings</AccordionTrigger>
              <AccordionContent>
                <form onSubmit={handleSave} className="grid grid-cols-4 gap-4 py-4">
                  {/* Auto Register Switch */}
                  <div className="flex items-center justify-between col-span-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="auto_register"
                        checked={settings.auto_register || false}
                        onCheckedChange={(checked) => handleSwitchChange('auto_register', checked)}
                      />
                      <Label htmlFor="auto_register">Auto Register New Users via OIDC</Label>
                    </div>
                  </div>

                  {/* Issuer URL */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="issuer_url" className="text-right col-span-1">
                    Issuer URL
                  </Label>
                  <Input
                    id="issuer_url"
                    value={settings.issuer_url}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="url"
                  />
                </div>

                {/* Client ID */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="client_id" className="text-right col-span-1">
                    Client ID
                  </Label>
                  <Input
                    id="client_id"
                    value={settings.client_id}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="client-id"
                  />
                </div>

                {/* Client Secret */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="client_secret" className="text-right col-span-1">
                    Client Secret
                  </Label>
                  <Input
                    id="client_secret"
                    type="password"
                    value={displayClientSecret}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="new-password"
                  />
                </div>

                {/* Scope */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="scope" className="text-right col-span-1">
                    Scope
                  </Label>
                  <Input
                    id="scope"
                    value={settings.scope || ''}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="off"
                  />
                </div>

                {/* Redirect URIs */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="redirect_uris" className="text-right col-span-1">
                    Redirect URIs (comma-separated)
                  </Label>
                  <Input
                    id="redirect_uris"
                    value={settings.redirect_uris ? settings.redirect_uris.join(', ') : ''}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="off"
                  />
                </div>

                {/* ID Token Signed Alg */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="id_token_signed_response_alg" className="text-right col-span-1">
                    ID Token Signed Alg
                  </Label>
                  <Input
                    id="id_token_signed_response_alg"
                    value={settings.id_token_signed_response_alg || ''}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="off"
                  />
                </div>

                {/* Userinfo Signed Alg */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="userinfo_signed_response_alg" className="text-right col-span-1">
                    Userinfo Signed Alg
                  </Label>
                  <Input
                    id="userinfo_signed_response_alg"
                    value={settings.userinfo_signed_response_alg || ''}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="off"
                  />
                </div>

                {/* Request Timeout */}
                <div className="grid grid-cols-4 items-center gap-4 col-span-4">
                  <Label htmlFor="request_timeout" className="text-right col-span-1">
                    Request Timeout (ms)
                  </Label>
                  <Input
                    id="request_timeout"
                    type="number"
                    value={settings.request_timeout || ''}
                    onChange={handleChange}
                    className="col-span-3"
                    autoComplete="off"
                  />
                </div>

                {/* Redirect URI Information */}
                <div className="col-span-4 text-sm text-muted-foreground mt-2">
                  <p>
                    The Redirect URI (Callback URL) for your OIDC provider should be: <code className="font-mono bg-gray-100 p-1 rounded">[Your App Base URL]/oidc-callback</code>
                  </p>
                  <p className="mt-1">
                    For example: <code className="font-mono bg-gray-100 p-1 rounded">https://fit.domain.com/oidc-callback</code>
                  </p>
                  <p className="mt-1">
                    Ensure your OIDC provider allows <code>localhost</code> or your local IP for development.
                  </p>
                  <p className="mt-2">
                    If using a proxy like Nginx Proxy Manager, ensure the following headers are configured:
                  </p>
                  <div className="relative group">
                    <pre id="proxy-config-code" className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                      <code>
                        proxy_set_header Host $host;<br/>
                        proxy_set_header X-Real-IP $remote_addr;<br/>
                        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;<br/>
                        proxy_set_header X-Forwarded-Proto $scheme;<br/>
                        add_header X-Content-Type-Options "nosniff";<br/>
                        proxy_set_header X-Forwarded-Ssl on;
                      </code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const codeBlock = document.getElementById('proxy-config-code');
                        if (codeBlock) {
                          // Replace <br/> with newlines for proper copying
                          const textToCopy = codeBlock.innerText.replace(/<br\/>/g, '\n');
                          navigator.clipboard.writeText(textToCopy);
                          toast({ title: "Copied!", description: "Proxy configuration copied to clipboard." });
                        }
                      }}
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 mt-4 col-span-4">
                    <Button variant="outline" type="button">Reset to default</Button>
                    <Button type="submit" disabled={loading}>Save OIDC Provider Settings</Button>
                  </div>
                </form>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuthenticationSettings;