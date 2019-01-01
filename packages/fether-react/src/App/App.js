// Copyright 2015-2018 Parity Technologies (UK) Ltd.
// This file is part of Parity.
//
// SPDX-License-Identifier: BSD-3-Clause

import React, { Component } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Redirect,
  Route,
  Switch
} from 'react-router-dom';
import { inject, observer } from 'mobx-react';
import isElectron from 'is-electron';
import ReactResizeDetector from 'react-resize-detector';
import styled, { ThemeProvider } from 'styled-components';
import { fetherTheme, GlobalStyle } from '../assets/theme/globalStyle';

import Accounts from '../Accounts';
import BackupAccount from '../BackupAccount';
import Onboarding from '../Onboarding';
import RequireHealth from '../RequireHealthOverlay';
import Send from '../Send';
import Tokens from '../Tokens';
import Whitelist from '../Whitelist';

// Use MemoryRouter for production viewing in file:// protocol
// https://github.com/facebook/create-react-app/issues/3591
const Router =
  process.env.NODE_ENV === 'production' ? MemoryRouter : BrowserRouter;
const electron = isElectron() ? window.require('electron') : null;

const DivContent = styled.div`
  overflow: visible;
  max-width: 22rem;
  margin: 0 auto;
`;

const DivWindow = styled.div`
  background: ${props => props.theme.chrome};
  border-radius: 0.25rem;
  min-height: 15rem;
  overflow: hidden;
  position: relative;
  box-shadow: 0 0.125rem 0.75rem rgba(${props => props.theme.black}, 0.175),
    0 0.125rem 0.125rem rgba(${props => props.theme.black}, 0.1);
`;

@inject('onboardingStore')
@observer
class App extends Component {
  handleResize = (_, height) => {
    if (!electron) {
      return;
    }
    // Send height to main process
    electron.ipcRenderer.send('asynchronous-message', 'app-resize', height);
  };

  /**
   * Decide which screen to render.
   */
  render () {
    const {
      onboardingStore: { isFirstRun }
    } = this.props;

    if (isFirstRun) {
      return (
        <div className='window'>
          <Onboarding />
        </div>
      );
    }

    return (
      <ReactResizeDetector handleHeight onResize={this.handleResize}>
        <ThemeProvider theme={fetherTheme}>
          <div>
            <GlobalStyle theme={fetherTheme} />
            <DivContent>
              <DivWindow>
                {/* Don't display child components requiring RPCs if API is not yet set */}
                <RequireHealth require='connected' fullscreen>
                  <Router>
                    <Switch>
                      {/* The next line is the homepage */}
                      <Redirect exact from='/' to='/accounts' />
                      <Route path='/accounts' component={Accounts} />
                      <Route path='/onboarding' component={Onboarding} />
                      <Route
                        path='/tokens/:accountAddress'
                        component={Tokens}
                      />
                      <Route
                        path='/whitelist/:accountAddress'
                        component={Whitelist}
                      />
                      <Route
                        path='/backup/:accountAddress'
                        component={BackupAccount}
                      />
                      <Route
                        path='/send/:tokenAddress/from/:accountAddress'
                        component={Send}
                      />
                      <Redirect from='*' to='/' />
                    </Switch>
                  </Router>
                </RequireHealth>
              </DivWindow>
            </DivContent>
          </div>
        </ThemeProvider>
      </ReactResizeDetector>
    );
  }
}

export default App;
