import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { gte, minVersion } from 'semver';
import { ApiService } from '@/app/core/api.service';
import { CustomPluginsService } from '@/app/core/manage-plugins/custom-plugins/custom-plugins.service';
import { ManagePluginComponent } from '@/app/core/manage-plugins/manage-plugin/manage-plugin.component';
import { ManageVersionComponent } from '@/app/core/manage-plugins/manage-version/manage-version.component';
import { ManualConfigComponent } from '@/app/core/manage-plugins/manual-config/manual-config.component'; // eslint-disable-line max-len
import { NodeUpdateRequiredComponent } from '@/app/core/manage-plugins/node-update-required/node-update-required.component'; // eslint-disable-line max-len
import { PluginBridgeComponent } from '@/app/core/manage-plugins/plugin-bridge/plugin-bridge.component';
import { PluginConfigComponent } from '@/app/core/manage-plugins/plugin-config/plugin-config.component';
import { UninstallPluginComponent } from '@/app/core/manage-plugins/uninstall-plugin/uninstall-plugin.component';
import { SettingsService } from '@/app/core/settings.service';

@Injectable({
  providedIn: 'root',
})
export class ManagePluginsService {

  constructor(
    private modalService: NgbModal,
    private customPluginsService: CustomPluginsService,
    private $settings: SettingsService,
    private $api: ApiService,
    private $toastr: ToastrService,
  ) {}

  installPlugin(pluginName: string, targetVersion = 'latest') {
    const ref = this.modalService.open(ManagePluginComponent, {
      size: 'lg',
      backdrop: 'static',
    });
    ref.componentInstance.action = 'Install';
    ref.componentInstance.pluginName = pluginName;
    ref.componentInstance.targetVersion = targetVersion;
  }

  uninstallPlugin(plugin: any) {
    const ref = this.modalService.open(UninstallPluginComponent, {
      size: 'lg',
      backdrop: 'static',
    });
    ref.componentInstance.action = 'Uninstall';
    ref.componentInstance.plugin = plugin;
  }

  async updatePlugin(plugin: any, targetVersion = 'latest') {
    if (!await this.checkNodeVersion(plugin)) {
      return;
    }

    const ref = this.modalService.open(ManagePluginComponent, {
      size: 'lg',
      backdrop: 'static',
    });
    ref.componentInstance.action = 'Update';
    ref.componentInstance.pluginName = plugin.name;
    ref.componentInstance.targetVersion = targetVersion;
    ref.componentInstance.latestVersion = plugin.latestVersion;
    ref.componentInstance.installedVersion = plugin.installedVersion;
    ref.componentInstance.isDisabled = plugin.disabled;
  }

  async upgradeHomebridge(homebridgePkg: any, targetVersion = 'latest') {
    if (!await this.checkNodeVersion(homebridgePkg)) {
      return;
    }

    const ref = this.modalService.open(ManagePluginComponent, {
      size: 'lg',
      backdrop: 'static',
    });
    ref.componentInstance.action = 'Update';
    ref.componentInstance.pluginName = homebridgePkg.name;
    ref.componentInstance.targetVersion = targetVersion;
    ref.componentInstance.latestVersion = homebridgePkg.latestVersion;
    ref.componentInstance.installedVersion = homebridgePkg.installedVersion;
  }

  /**
   * Open the version selector
   *
   * @param plugin
   */
  async installPreviousVersion(plugin: any) {
    const ref = this.modalService.open(ManageVersionComponent, {
      size: 'lg',
      backdrop: 'static',
    });

    ref.componentInstance.plugin = plugin;

    try {
      const targetVersion = await ref.result;
      return plugin.installedVersion && plugin.name !== 'homebridge' ?
        await this.updatePlugin(plugin, targetVersion) :
        this.installPlugin(plugin.name, targetVersion);
    } catch (e) {
      // do nothing
    }
  }

  /**
   * Open the child bridge modal
   *
   * @param plugin
   */
  async bridgeSettings(plugin: any) {
    // load the plugins schema
    let schema: any;
    if (plugin.settingsSchema) {
      try {
        schema = await this.loadConfigSchema(plugin.name);
      } catch (e) {
        this.$toastr.error('Failed to load plugins config schema.');
        return;
      }
    }

    const ref = this.modalService.open(PluginBridgeComponent, {
      size: 'lg',
      backdrop: 'static',
    });

    ref.componentInstance.schema = schema;
    ref.componentInstance.plugin = plugin;
  }

  /**
   * Open the plugin settings modal
   *
   * @param plugin
   */
  async settings(plugin: any) {
    // load the plugins schema
    let schema: any;
    if (plugin.settingsSchema) {
      try {
        schema = await this.loadConfigSchema(plugin.name);
      } catch (e) {
        this.$toastr.error('Failed to load plugins config schema.');
        return;
      }
    }

    // open the custom ui if the plugin has one
    if (schema && schema.customUi) {
      return this.customPluginsService.openCustomSettingsUi(plugin, schema);
    }

    if (this.customPluginsService.plugins[plugin.name]) {
      return this.customPluginsService.openSettings(plugin, schema);
    }

    // open the standard ui
    const ref = this.modalService.open(
      plugin.settingsSchema ? PluginConfigComponent : ManualConfigComponent,
      {
        size: 'lg',
        backdrop: 'static',
      },
    );

    ref.componentInstance.schema = schema;
    ref.componentInstance.plugin = plugin;

    return ref.result.catch(() => {
      // do nothing
    });
  }

  /**
   * Open the json config modal
   */
  async jsonEditor(plugin: any) {
    const ref = this.modalService.open(
      ManualConfigComponent,
      {
        size: 'lg',
        backdrop: 'static',
      },
    );

    ref.componentInstance.plugin = plugin;

    return ref.result.catch(() => {
      // do nothing
    });
  }

  private async loadConfigSchema(pluginName: string) {
    return this.$api.get(`/plugins/config-schema/${encodeURIComponent(pluginName)}`).toPromise();
  }

  private async checkNodeVersion(plugin: any): Promise<boolean> {
    if (plugin.engines && plugin.engines.node) {
      if (gte(this.$settings.env.nodeVersion, minVersion(plugin.engines.node))) {
        return true;
      }

      try {
        // open modal warning about Node.js version
        const ref = this.modalService.open(NodeUpdateRequiredComponent, {
          size: 'lg',
          backdrop: 'static',
        });
        ref.componentInstance.plugin = plugin;

        return await ref.result;
      } catch (e) {
        return false;
      }
    } else {
      return true;
    }
  }
}
