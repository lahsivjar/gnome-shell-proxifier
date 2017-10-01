import os
import time
import sys
import re
from threading import Thread as th
from gi.repository import Gio as gio

def switch_proxy(host, port, username=None, password=None):

    modeManual = gio.Settings.new("org.gnome.system.proxy")
    modeManual.set_string("mode", "manual")

    http_Settings = gio.Settings.new("org.gnome.system.proxy.http")
    
    retValue = http_Settings.set_string("host", host)
    retValue = retValue and http_Settings.set_int("port", port)
    
    https_Settings = gio.Settings.new("org.gnome.system.proxy.https")

    retValue = retValue and https_Settings.set_string("host", host)
    retValue = retValue and https_Settings.set_int("port", port)

    if username is not None:
        retValue = retValue and http_Settings.set_boolean("use-authentication", True)
        retValue = retValue and http_Settings.set_string("authentication_user", username)
        retValue = retValue and http_Settings.set_string("authentication_password", password)
    
    return retValue

class find_proxy(th):
    def __init__(self, host):
        th.__init__(self)
        self.host = host
        self.ip = host.split(':')[0]
        self.time = -1
        self.status = -1

    def run(self):
        pingIp = os.popen("ping -q -c2 -w5 " + self.ip, "r")
        while True:
            result = pingIp.readline()
            if not result:
                break
            retStatus = re.findall(find_proxy.pingStatus, result)
            retTime = re.findall(find_proxy.pingTime, result)
            if retStatus:
                self.status = int(retStatus[0])
            if retTime:
                self.time = int(retTime[0])

def main():
    find_proxy.pingStatus = re.compile(r"(\d) received")
    find_proxy.pingTime = re.compile(r"time (\d*)ms")
    fastest_proxy_time = 9999
    fastest_proxy_status = -1

    proxychecked = []

    with open(sys.argv[1], "r+") as f_proxy:
        hosts = f_proxy.read().splitlines()

    for host in hosts:
        active = find_proxy(host)
        proxychecked.append(active)
        active.start()

    for p in proxychecked:
        p.join()
        if (fastest_proxy_time > p.time):
            fastest_proxy_time = p.time
            fastest_proxy = p.host
            fastest_proxy_status = p.status

    fastest_proxy = fastest_proxy.split(':')
    if fastest_proxy_status != 0:
        success = switch_proxy(fastest_proxy[0], int(fastest_proxy[1]))
        print "Switching to " + fastest_proxy[0] + "... " + str(success)

if __name__=="__main__":
    main()
