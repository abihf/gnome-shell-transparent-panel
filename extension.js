const Main = imports.ui.main;
const Config = imports.misc.config;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

// Original code from
// https://extensions.gnome.org/extension/2878/transparent-top-panel/

class TransparentPanel {

    constructor()
    {
        this._signalIds = new Map();

        this._signalIds.set(Main.overview, [
            Main.overview.connect('showing', this._updateSolidStyle.bind(this)),
            Main.overview.connect('hiding', this._updateSolidStyle.bind(this))
        ]);

        this._signalIds.set(Main.sessionMode, [
            Main.sessionMode.connect('updated', this._updateSolidStyle.bind(this))
        ]);

        for (const metaWindowActor of global.get_window_actors())
            this._onWindowActorAdded(metaWindowActor.get_parent(), metaWindowActor);

        this._signalIds.set(global.window_group, [
            global.window_group.connect('actor-added', this._onWindowActorAdded.bind(this)),
            global.window_group.connect('actor-removed', this._onWindowActorRemoved.bind(this))
        ]);

        this._signalIds.set(global.window_manager, [
            global.window_manager.connect('switch-workspace', this._updateSolidStyle.bind(this))
        ]);

        this._updateSolidStyle();
    }

    destroy()
    {
        for (const [actor, signalIds] of this._signalIds)
            for (const signalId of signalIds)
                actor.disconnect(signalId);
        this._signalIds.clear();
    }

    _onWindowActorAdded(container, metaWindowActor)
    {
        // TODO: create efficient listener for these events
        const signalIds = ['allocation-changed', 'notify::visible'].map(s => {
            metaWindowActor.connect(s, this._updateSolidStyle.bind(this));
        });
        this._signalIds.set(metaWindowActor, signalIds);
    }

    _onWindowActorRemoved(container, metaWindowActor)
    {
        this._signalIds.get(metaWindowActor).forEach(id => {
            metaWindowActor.disconnect(id);
        });
        this._signalIds.delete(metaWindowActor);
        this._updateSolidStyle();
    }

    _updateSolidStyle() {
        if (Main.panel.has_style_pseudo_class('overview') || !Main.sessionMode.hasWindows)
        {
            Main.panel._addStyleClassName('transparent');
            return;
        }

        if (!Main.layoutManager.primaryMonitor)
            return;

        /* Check if at least one window is near enough to the panel */
        const [, panelTop] = Main.panel.get_transformed_position();
        const panelBottom = panelTop + Main.panel.get_height();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const isNearEnough = activeWorkspace.list_windows().some(metaWindow => {
            if (metaWindow.is_on_primary_monitor() &&
                metaWindow.showing_on_its_workspace() &&
                !metaWindow.is_hidden() &&
                metaWindow.get_window_type() != Meta.WindowType.DESKTOP)
            {
              const verticalPosition = metaWindow.get_frame_rect().y;
              return verticalPosition < panelBottom + 5 * scale;
            }
            return false;
        });


        if (isNearEnough)
            Main.panel._removeStyleClassName('transparent');
        else
            Main.panel._addStyleClassName('transparent');
    }
};


let _version;
let _transparentPanel;

function init()
{
    _version = parseInt(Config.PACKAGE_VERSION.split('.')[1]);
}

function enable()
{
    Main.panel._addStyleClassName('transparent');

    if (_version > 30)
        _transparentPanel = new TransparentPanel();
}

function disable()
{
    if (_version > 30)
        _transparentPanel.destroy();

    Main.panel._removeStyleClassName('transparent');
}
